/* ==========================================================================
   blocs.js — Blocs (jeu de blocs qui tombent)
   --------------------------------------------------------------------------
   Règle : des pièces de 4 carrés tombent dans un puits de 10 × 20 cases.
   On les déplace et on les tourne pour remplir des lignes complètes, qui
   disparaissent et rapportent des points. Toutes les 10 lignes, on passe
   au niveau suivant et les pièces tombent plus vite. On perd quand les
   pièces débordent en haut.

   Notions importantes :
   - chaque pièce est une petite matrice (tableau de tableaux) de 0 et de 1,
   - tourner une pièce = faire pivoter cette matrice d'un quart de tour,
   - « collision » = la pièce sortirait du puits ou chevaucherait un bloc.
   ========================================================================== */

(function () {
  const COLONNES = 10;
  const LIGNES = 20;
  const CASE = 22;                          // taille d'une case en pixels
  const LARGEUR_PUITS = COLONNES * CASE;    // 220 px
  const L = 340;                            // le canvas : puits + panneau à droite
  const H = LIGNES * CASE;                  // 440 px
  const C = Arcade.couleurs;

  // Les 7 pièces. 1 = un carré, 0 = vide.
  const PIECES = {
    I: { couleur: C.cyan,   forme: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { couleur: C.jaune,  forme: [[1, 1], [1, 1]] },
    T: { couleur: C.violet, forme: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { couleur: C.vert,   forme: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { couleur: C.rouge,  forme: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { couleur: C.bleu,   forme: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { couleur: C.orange, forme: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] }
  };
  // Points pour 1, 2, 3 ou 4 lignes d'un coup (multipliés par le niveau)
  const POINTS_LIGNES = [0, 100, 300, 500, 800];

  let api, ctx, boucle;
  let grille;           // grille[ligne][colonne] = couleur du bloc posé, ou null
  let piece;            // { type, forme, x, y }
  let suivante;         // type de la prochaine pièce
  let sac = [];
  let score, lignes, niveau, cumul;
  let lignesPleines;    // lignes en train de disparaître (petite animation)
  let tempsEffacement;
  let finie, minuteurFin;

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie) {
    api = apiPartie;
    ctx = api.creerCanvas(L, H).ctx;

    grille = [];
    for (let l = 0; l < LIGNES; l++) grille.push(new Array(COLONNES).fill(null));
    sac = [];
    score = 0;
    lignes = 0;
    niveau = 1;
    cumul = 0;
    lignesPleines = [];
    finie = false;
    suivante = tirerPiece();
    nouvellePiece();
    majHud();

    // Sur mobile : un bouton pour la chute directe (même effet que la touche Espace)
    api.boutonTactile('⤓ CHUTE', 'Space');

    boucle = Arcade.creerBoucle(miseAJour);
    boucle.demarrer();
  }

  /* Le « sac » : on mélange les 7 pièces et on les distribue une par une.
     Quand le sac est vide, on en remplit un nouveau. Ainsi, on n'attend
     jamais trop longtemps la pièce dont on a besoin. */
  function tirerPiece() {
    if (sac.length === 0) {
      sac = Object.keys(PIECES);
      // Mélange de Fisher-Yates
      for (let i = sac.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = sac[i];
        sac[i] = sac[j];
        sac[j] = temp;
      }
    }
    return sac.pop();
  }

  function nouvellePiece() {
    const type = suivante;
    suivante = tirerPiece();
    const forme = PIECES[type].forme.map(function (ligne) { return ligne.slice(); }); // copie
    piece = {
      type: type,
      forme: forme,
      x: Math.floor((COLONNES - forme[0].length) / 2),
      y: type === 'I' ? -1 : 0
    };
    // Plus de place pour la nouvelle pièce : perdu !
    if (collision(piece.forme, piece.x, piece.y)) perdre();
  }

  /* ---------- Collisions ---------- */
  function collision(forme, px, py) {
    for (let r = 0; r < forme.length; r++) {
      for (let c = 0; c < forme[r].length; c++) {
        if (!forme[r][c]) continue;
        const x = px + c;
        const y = py + r;
        if (x < 0 || x >= COLONNES || y >= LIGNES) return true; // hors du puits
        if (y >= 0 && grille[y][x]) return true;                // un bloc déjà là
      }
    }
    return false;
  }

  /* ---------- Mouvements ---------- */
  function peutJouer() {
    return piece && !finie && lignesPleines.length === 0;
  }

  function bouger(dx) {
    if (!peutJouer()) return;
    if (!collision(piece.forme, piece.x + dx, piece.y)) piece.x += dx;
  }

  // Rotation d'un quart de tour dans le sens des aiguilles d'une montre
  function tourner() {
    if (!peutJouer()) return;
    const n = piece.forme.length;
    const tournee = [];
    for (let r = 0; r < n; r++) {
      tournee.push([]);
      for (let c = 0; c < n; c++) {
        tournee[r][c] = piece.forme[n - 1 - c][r];
      }
    }
    // Si la pièce tournée cogne, on essaie de la décaler un peu (« wall kick »)
    const decalages = [0, -1, 1, -2, 2];
    for (const d of decalages) {
      if (!collision(tournee, piece.x + d, piece.y)) {
        piece.forme = tournee;
        piece.x += d;
        return;
      }
    }
  }

  // Descend d'une case. Si c'est impossible, la pièce se pose.
  function descendre(parLeJoueur) {
    if (!peutJouer()) return;
    if (!collision(piece.forme, piece.x, piece.y + 1)) {
      piece.y++;
      if (parLeJoueur) {
        score += 1; // petit bonus pour la descente rapide
        cumul = 0;
        majHud();
      }
    } else {
      poser();
    }
  }

  function chuteDirecte() {
    if (!peutJouer()) return;
    let cases = 0;
    while (!collision(piece.forme, piece.x, piece.y + 1)) {
      piece.y++;
      cases++;
    }
    score += cases * 2;
    poser();
  }

  // La pièce devient une partie du décor
  function poser() {
    for (let r = 0; r < piece.forme.length; r++) {
      for (let c = 0; c < piece.forme[r].length; c++) {
        if (!piece.forme[r][c]) continue;
        const y = piece.y + r;
        if (y < 0) { perdre(); return; } // posée au-dessus du puits : perdu
        grille[y][piece.x + c] = PIECES[piece.type].couleur;
      }
    }
    cumul = 0;

    // Y a-t-il des lignes complètes ?
    lignesPleines = [];
    for (let l = 0; l < LIGNES; l++) {
      if (grille[l].every(function (caseGrille) { return caseGrille !== null; })) lignesPleines.push(l);
    }
    if (lignesPleines.length) {
      piece = null;
      tempsEffacement = 0.25; // les lignes clignotent 0,25 s avant de disparaître
    } else {
      nouvellePiece();
    }
    majHud();
  }

  function effacerLignes() {
    // De haut en bas : on retire la ligne pleine et on ajoute une ligne vide en haut
    for (const l of lignesPleines) {
      grille.splice(l, 1);
      grille.unshift(new Array(COLONNES).fill(null));
    }
    const n = lignesPleines.length;
    score += POINTS_LIGNES[n] * niveau;
    lignes += n;
    niveau = 1 + Math.floor(lignes / 10); // un niveau toutes les 10 lignes
    lignesPleines = [];
    nouvellePiece();
    majHud();
  }

  // Temps entre deux descentes automatiques (diminue avec le niveau)
  function intervalleChute() {
    return Math.max(60, 800 * Math.pow(0.85, niveau - 1));
  }

  function perdre() {
    if (finie) return;
    finie = true;
    boucle.arreter();
    dessiner();
    minuteurFin = setTimeout(function () {
      api.fin({ valeur: score, titre: 'GAME OVER', details: 'Lignes : ' + lignes + ' - Niveau : ' + niveau });
    }, 800);
  }

  function majHud() {
    api.hud('SCORE ' + score, 'NIVEAU ' + niveau);
  }

  /* ---------- Boucle ---------- */
  function miseAJour(dt) {
    if (lignesPleines.length) {
      tempsEffacement -= dt;
      if (tempsEffacement <= 0) effacerLignes();
    } else {
      cumul += dt * 1000;
      if (cumul >= intervalleChute()) {
        cumul = 0;
        descendre(false);
      }
    }
    if (!finie) dessiner();
  }

  /* ---------- Dessin ---------- */
  function dessinerBloc(x, y, couleur, taille) {
    taille = taille || CASE;
    ctx.fillStyle = couleur;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x + 1, y + 1, taille - 2, taille - 2);
    // Un petit reflet clair en haut du bloc
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 3, y + 3, taille - 6, 3);
    ctx.globalAlpha = 1;
  }

  // Où la pièce atterrirait-elle ? (pour dessiner son « fantôme »)
  function yFantome() {
    let y = piece.y;
    while (!collision(piece.forme, piece.x, y + 1)) y++;
    return y;
  }

  function dessiner() {
    // Fond
    ctx.fillStyle = Arcade.couleurs.fond;
    ctx.fillRect(0, 0, L, H);

    // Quadrillage du puits
    ctx.strokeStyle = 'rgba(166, 77, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLONNES; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CASE + 0.5, 0);
      ctx.lineTo(c * CASE + 0.5, H);
      ctx.stroke();
    }
    for (let l = 1; l < LIGNES; l++) {
      ctx.beginPath();
      ctx.moveTo(0, l * CASE + 0.5);
      ctx.lineTo(LARGEUR_PUITS, l * CASE + 0.5);
      ctx.stroke();
    }

    // Les blocs déjà posés
    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLONNES; c++) {
        if (grille[l][c]) {
          const couleur = finie ? '#555577' : grille[l][c];
          dessinerBloc(c * CASE, l * CASE, couleur);
        }
      }
    }

    // Lignes complètes qui clignotent en blanc
    if (lignesPleines.length) {
      ctx.fillStyle = Math.floor(tempsEffacement * 20) % 2 ? '#ffffff' : C.violet;
      for (const l of lignesPleines) ctx.fillRect(0, l * CASE, LARGEUR_PUITS, CASE);
    }

    // La pièce et son fantôme
    if (piece && !finie) {
      const couleur = PIECES[piece.type].couleur;
      const yf = yFantome();
      ctx.strokeStyle = couleur;
      ctx.globalAlpha = 0.4;
      for (let r = 0; r < piece.forme.length; r++) {
        for (let c = 0; c < piece.forme[r].length; c++) {
          if (piece.forme[r][c] && yf + r >= 0) {
            ctx.strokeRect((piece.x + c) * CASE + 2.5, (yf + r) * CASE + 2.5, CASE - 5, CASE - 5);
          }
        }
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.shadowColor = couleur;
      ctx.shadowBlur = 12;
      for (let r = 0; r < piece.forme.length; r++) {
        for (let c = 0; c < piece.forme[r].length; c++) {
          if (piece.forme[r][c] && piece.y + r >= 0) {
            dessinerBloc((piece.x + c) * CASE, (piece.y + r) * CASE, couleur);
          }
        }
      }
      ctx.restore();
    }

    // Bord du puits
    ctx.fillStyle = C.violet;
    ctx.fillRect(LARGEUR_PUITS, 0, 2, H);

    // Panneau de droite
    const px = LARGEUR_PUITS + (L - LARGEUR_PUITS) / 2;
    Arcade.texte(ctx, 'SUIVANT', px, 24, 9, C.jaune);
    const formeSuivante = PIECES[suivante].forme;
    const petite = 16;
    const largeurForme = formeSuivante[0].length * petite;
    for (let r = 0; r < formeSuivante.length; r++) {
      for (let c = 0; c < formeSuivante[r].length; c++) {
        if (formeSuivante[r][c]) {
          dessinerBloc(px - largeurForme / 2 + c * petite, 44 + r * petite, PIECES[suivante].couleur, petite);
        }
      }
    }
    Arcade.texte(ctx, 'NIVEAU', px, 150, 9, C.jaune);
    Arcade.texte(ctx, String(niveau), px, 172, 12, C.cyan);
    Arcade.texte(ctx, 'LIGNES', px, 214, 9, C.jaune);
    Arcade.texte(ctx, String(lignes), px, 236, 12, C.cyan);
    Arcade.texte(ctx, 'SCORE', px, 278, 9, C.jaune);
    Arcade.texte(ctx, String(score), px, 300, 10, C.cyan);

    if (finie) {
      ctx.fillStyle = 'rgba(0, 0, 16, 0.6)';
      ctx.fillRect(0, 0, LARGEUR_PUITS, H);
      Arcade.texte(ctx, 'PERDU !', LARGEUR_PUITS / 2, H / 2, 16, C.rose);
    }
  }

  /* ---------- Contrôles ---------- */
  function touche(code) {
    if (code === 'Space') { chuteDirecte(); return; }
    const dir = Arcade.controles.direction(code);
    if (dir === 'gauche') bouger(-1);
    else if (dir === 'droite') bouger(1);
    else if (dir === 'haut') tourner();
    else if (dir === 'bas') descendre(true);
  }

  function balayage(dir) {
    if (dir === 'gauche') bouger(-1);
    else if (dir === 'droite') bouger(1);
    else if (dir === 'bas') descendre(true);
  }

  function tape() {
    tourner();
  }

  /* ---------- Pause / arrêt ---------- */
  function pause() { if (boucle) boucle.arreter(); }
  function reprendre() { if (boucle && !finie) boucle.demarrer(); }
  function arreter() {
    if (boucle) boucle.arreter();
    clearTimeout(minuteurFin);
  }

  /* ---------- Inscription ---------- */
  Arcade.enregistrerJeu({
    id: 'blocs',
    nom: 'BLOCS',
    couleur: Arcade.couleurs.violet,
    resume: 'Complète des lignes',
    description: 'Empile les pièces qui tombent pour former des lignes complètes. Toutes les 10 lignes, ça accélère !',
    icone: [
      '###.....',
      '.#......',
      '........',
      '....##..',
      '#...##..',
      '#.......',
      '##.####.',
      '........'
    ],
    controles: [
      ['GAUCHE DROITE / Q D', 'Déplacer la pièce'],
      ['HAUT / Z', 'Tourner'],
      ['BAS / S', 'Descendre plus vite'],
      ['Espace', 'Chute directe'],
      ['Mobile', 'Glisser ← → ↓, toucher pour tourner, bouton CHUTE']
    ],
    balayageContinu: true,
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter,
    touche: touche,
    balayage: balayage,
    tape: tape
  });
})();
