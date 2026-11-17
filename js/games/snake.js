/* ==========================================================================
   snake.js — Snake
   --------------------------------------------------------------------------
   Règle : le serpent avance tout seul. On le dirige pour manger les pommes.
   Chaque pomme le fait grandir et accélérer. On perd si on touche un mur
   ou son propre corps.

   Notions importantes :
   - le <canvas> : une zone de dessin. On y dessine avec « ctx » (le contexte),
     par exemple ctx.fillRect(x, y, largeur, hauteur) dessine un rectangle.
   - la boucle de jeu (voir Arcade.creerBoucle dans arcade.js).
   - le serpent avance par « cases » à intervalle régulier : on cumule le
     temps écoulé, et dès qu'il dépasse l'intervalle, on avance d'une case.
   ========================================================================== */

(function () {
  const COLONNES = 20;
  const LIGNES = 20;
  const CASE = 20; // taille d'une case en pixels → canvas de 400 × 400

  const INTERVALLE_DEPART = 150; // ms entre deux pas au début
  const INTERVALLE_MIN = 60;     // vitesse maximale

  let api, ctx, boucle;
  let serpent;          // liste de cases {x, y}. serpent[0] = la tête
  let direction;        // {x, y} : (1,0) = droite, (0,-1) = haut…
  let fileDirections;   // directions demandées mais pas encore appliquées
  let pomme;
  let score, pommesMangees, intervalle, cumul;
  let mort, minuteurFin;

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie) {
    api = apiPartie;
    ctx = api.creerCanvas(COLONNES * CASE, LIGNES * CASE).ctx;

    serpent = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    direction = { x: 1, y: 0 };
    fileDirections = [];
    score = 0;
    pommesMangees = 0;
    intervalle = INTERVALLE_DEPART;
    cumul = 0;
    mort = false;
    placerPomme();
    majHud();

    boucle = Arcade.creerBoucle(miseAJour);
    boucle.demarrer();
  }

  function niveau() {
    return 1 + Math.floor(pommesMangees / 5);
  }

  function majHud() {
    api.hud('SCORE ' + score, 'NIVEAU ' + niveau());
  }

  // Place la pomme sur une case libre au hasard
  function placerPomme() {
    const libres = [];
    for (let x = 0; x < COLONNES; x++) {
      for (let y = 0; y < LIGNES; y++) {
        const occupee = serpent.some(function (s) { return s.x === x && s.y === y; });
        if (!occupee) libres.push({ x: x, y: y });
      }
    }
    pomme = libres[Math.floor(Math.random() * libres.length)];
  }

  /* ---------- Boucle ---------- */
  function miseAJour(dt) {
    cumul += dt * 1000;
    // « while » et pas « if » : si l'ordinateur a ramé, on rattrape les pas manqués
    while (cumul >= intervalle) {
      cumul -= intervalle;
      avancer();
      if (mort) break;
    }
    dessiner();
  }

  // Avance d'une case
  function avancer() {
    if (fileDirections.length) direction = fileDirections.shift();

    const tete = { x: serpent[0].x + direction.x, y: serpent[0].y + direction.y };
    const mange = tete.x === pomme.x && tete.y === pomme.y;

    // Collision avec un mur ?
    const horsJeu = tete.x < 0 || tete.x >= COLONNES || tete.y < 0 || tete.y >= LIGNES;
    // Collision avec le corps ? (la queue va bouger, sauf si on mange)
    const corps = mange ? serpent : serpent.slice(0, -1);
    const surLuiMeme = corps.some(function (s) { return s.x === tete.x && s.y === tete.y; });

    if (horsJeu || surLuiMeme) {
      mourir();
      return;
    }

    serpent.unshift(tete); // on ajoute la nouvelle tête au début…
    if (mange) {
      pommesMangees++;
      score += 10 * niveau();
      // La difficulté augmente : un peu plus rapide à chaque pomme
      intervalle = Math.max(INTERVALLE_MIN, INTERVALLE_DEPART - pommesMangees * 3);
      if (serpent.length === COLONNES * LIGNES) { mourir(true); return; }
      placerPomme();
      majHud();
    } else {
      serpent.pop(); // …et on retire le bout de la queue (sauf si on a mangé : il grandit)
    }
  }

  function mourir(victoire) {
    mort = true;
    boucle.arreter();
    dessiner();
    minuteurFin = setTimeout(function () {
      api.fin({
        valeur: score,
        titre: victoire ? 'PARFAIT !' : 'GAME OVER',
        details: 'Longueur du serpent : ' + serpent.length
      });
    }, 700);
  }

  /* ---------- Changer de direction ----------
     On met les demandes dans une file : si on appuie très vite sur ↑ puis ←,
     les deux virages sont faits l'un après l'autre au lieu de se perdre.
     Et on interdit le demi-tour (on se mangerait soi-même). */
  function changerDirection(nom) {
    const vecteurs = {
      haut: { x: 0, y: -1 },
      bas: { x: 0, y: 1 },
      gauche: { x: -1, y: 0 },
      droite: { x: 1, y: 0 }
    };
    const nouvelle = vecteurs[nom];
    const derniere = fileDirections.length ? fileDirections[fileDirections.length - 1] : direction;
    const demiTour = nouvelle.x === -derniere.x && nouvelle.y === -derniere.y;
    const identique = nouvelle.x === derniere.x && nouvelle.y === derniere.y;
    if (demiTour || identique || fileDirections.length >= 3) return;
    fileDirections.push(nouvelle);
  }

  /* ---------- Dessin ---------- */
  function dessiner() {
    const L = COLONNES * CASE;
    const H = LIGNES * CASE;

    // Fond + quadrillage discret
    ctx.fillStyle = Arcade.couleurs.fond;
    ctx.fillRect(0, 0, L, H);
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < COLONNES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CASE + 0.5, 0);
      ctx.lineTo(i * CASE + 0.5, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CASE + 0.5);
      ctx.lineTo(L, i * CASE + 0.5);
      ctx.stroke();
    }

    // La pomme qui « pulse » (sa lueur varie avec le temps grâce à Math.sin)
    const pulsation = 0.5 + 0.5 * Math.sin(performance.now() / 150);
    ctx.save();
    ctx.shadowColor = Arcade.couleurs.rouge;
    ctx.shadowBlur = 8 + pulsation * 10;
    ctx.fillStyle = Arcade.couleurs.rouge;
    ctx.fillRect(pomme.x * CASE + 4, pomme.y * CASE + 4, CASE - 8, CASE - 8);
    ctx.restore();

    // Le serpent
    ctx.save();
    ctx.shadowColor = Arcade.couleurs.vert;
    ctx.shadowBlur = 10;
    serpent.forEach(function (s, i) {
      if (i === 0) ctx.fillStyle = mort ? Arcade.couleurs.rouge : '#c8ffb8'; // tête plus claire
      else ctx.fillStyle = Arcade.couleurs.vert;
      ctx.fillRect(s.x * CASE + 1, s.y * CASE + 1, CASE - 2, CASE - 2);
    });
    ctx.restore();

    // Les yeux, orientés dans la direction du mouvement
    const tete = serpent[0];
    ctx.fillStyle = '#000010';
    const cx = tete.x * CASE + CASE / 2;
    const cy = tete.y * CASE + CASE / 2;
    const ox = direction.y !== 0 ? 4 : 0; // écart entre les deux yeux
    const oy = direction.x !== 0 ? 4 : 0;
    ctx.fillRect(cx + direction.x * 4 - ox - 2, cy + direction.y * 4 - oy - 2, 3, 3);
    ctx.fillRect(cx + direction.x * 4 + ox - 2, cy + direction.y * 4 + oy - 2, 3, 3);
  }

  /* ---------- Contrôles ---------- */
  function touche(code) {
    const dir = Arcade.controles.direction(code);
    if (dir) changerDirection(dir);
  }

  function balayage(dir) {
    changerDirection(dir);
  }

  /* ---------- Pause / arrêt ---------- */
  function pause() {
    if (boucle) boucle.arreter();
  }
  function reprendre() {
    if (boucle && !mort) boucle.demarrer();
  }
  function arreter() {
    if (boucle) boucle.arreter();
    clearTimeout(minuteurFin);
  }

  /* ---------- Inscription ---------- */
  Arcade.enregistrerJeu({
    id: 'snake',
    nom: 'SNAKE',
    couleur: Arcade.couleurs.vert,
    resume: 'Mange, grandis, survis',
    description: 'Dirige le serpent pour manger les pommes. Il grandit et accélère. Ne touche ni les murs, ni ta queue !',
    icone: [
      '......#.',
      '........',
      '#####...',
      '....#...',
      '.####...',
      '.#......',
      '.######.',
      '......#.'
    ],
    controles: [
      ['FLÈCHES / ZQSD', 'Diriger le serpent'],
      ['Balayage', 'Diriger (mobile)']
    ],
    balayageContinu: true,
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter,
    touche: touche,
    balayage: balayage
  });
})();
