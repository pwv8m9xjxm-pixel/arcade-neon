/* ==========================================================================
   invasion.js — Invasion (tir sur des vagues d'aliens)
   --------------------------------------------------------------------------
   Règle : une formation d'aliens avance de gauche à droite et descend d'un
   cran à chaque bord. Ton vaisseau, en bas, les détruit en tirant. Les
   aliens tirent aussi ! Tu as 3 vies. Chaque vague détruite en amène une
   nouvelle, plus rapide et plus agressive. Si les aliens atteignent ton
   vaisseau, c'est perdu.

   Notions importantes :
   - les sprites (dessins en pixels) sont préparés une seule fois,
   - la formation accélère quand il reste moins d'aliens,
   - tous les objets (tirs, aliens) sont des rectangles : on teste les
     collisions avec Arcade.collision().
   ========================================================================== */

(function () {
  const L = 360;
  const H = 540;
  const C = Arcade.couleurs;
  const COLONNES = 8;
  const RANGEES = 5;
  const PIXEL = 2;                  // les sprites aliens sont agrandis ×2
  const LARGEUR_ALIEN = 11 * PIXEL; // 22 px
  const HAUTEUR_ALIEN = 8 * PIXEL;  // 16 px
  const ECART_X = 34;
  const ECART_Y = 28;

  // Trois modèles d'aliens « maison », chacun avec 2 images d'animation
  const MODELES = {
    meduse: {
      couleur: C.violet, points: 30,
      images: [
        ['...#####...',
         '..#######..',
         '.##.###.##.',
         '.#########.',
         '..#.#.#.#..',
         '..#.#.#.#..',
         '.#..#.#..#.',
         '...........'],
        ['...#####...',
         '..#######..',
         '.##.###.##.',
         '.#########.',
         '..#.#.#.#..',
         '.#..#.#..#.',
         '..#.#.#.#..',
         '...........']
      ]
    },
    oeil: {
      couleur: C.rose, points: 20,
      images: [
        ['....###....',
         '..#######..',
         '.###...###.',
         '###..#..###',
         '.###...###.',
         '..#######..',
         '..#.#.#.#..',
         '.#.......#.'],
        ['....###....',
         '..#######..',
         '.###...###.',
         '###.#.#.###',
         '.###...###.',
         '..#######..',
         '.#.#...#.#.',
         '..#.....#..']
      ]
    },
    insecte: {
      couleur: C.vert, points: 10,
      images: [
        ['#.........#',
         '.#.#####.#.',
         '..#######..',
         '.##.#.#.##.',
         '.#########.',
         '...#...#...',
         '..#.....#..',
         '.#.......#.'],
        ['.#.......#.',
         '..#.###.#..',
         '..#######..',
         '.##.#.#.##.',
         '.#########.',
         '...#...#...',
         '...#...#...',
         '..#.....#..']
      ]
    }
  };
  const TYPE_PAR_RANGEE = ['meduse', 'oeil', 'oeil', 'insecte', 'insecte'];

  const VAISSEAU = [
    '......#......',
    '.....###.....',
    '.....###.....',
    '..#..###..#..',
    '.###########.',
    '#############',
    '#####.#.#####',
    '##.........##'
  ];

  let api, ctx, boucle;
  let sprites = null;
  let joueur, tirs, tirsAliens, aliens, explosions, etoiles;
  let sens, vague, vies, score, recharge, minuteurTirAlien;
  let tempsAnim, image, invincible, banniere;
  let finie, minuteurFin;

  // On prépare tous les sprites une seule fois
  function preparerSprites() {
    sprites = { vaisseau: Arcade.sprite(VAISSEAU, C.cyan, 2, 6) };
    Object.keys(MODELES).forEach(function (nom) {
      const m = MODELES[nom];
      sprites[nom] = m.images.map(function (img) { return Arcade.sprite(img, m.couleur, PIXEL, 5); });
    });
  }

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie) {
    api = apiPartie;
    ctx = api.creerCanvas(L, H).ctx;
    if (!sprites) preparerSprites();

    joueur = { x: L / 2 - 13, y: H - 50, l: 26, h: 16 };
    vague = 1;
    vies = 3;
    score = 0;
    finie = false;
    explosions = [];
    etoiles = Arcade.creerEtoiles(60, L, H);
    nouvelleVague();
    majHud();

    // Boutons tactiles (mobile) : ils simulent les touches du clavier
    api.boutonTactile('◀', 'ArrowLeft');
    api.boutonTactile('FEU', 'Space');
    api.boutonTactile('▶', 'ArrowRight');

    boucle = Arcade.creerBoucle(miseAJour);
    boucle.demarrer();
  }

  function nouvelleVague() {
    aliens = [];
    const largeurFormation = (COLONNES - 1) * ECART_X + LARGEUR_ALIEN;
    const x0 = (L - largeurFormation) / 2;
    const y0 = 60 + Math.min(vague - 1, 5) * 12; // chaque vague commence un peu plus bas
    for (let r = 0; r < RANGEES; r++) {
      for (let c = 0; c < COLONNES; c++) {
        const type = TYPE_PAR_RANGEE[r];
        aliens.push({
          x: x0 + c * ECART_X,
          y: y0 + r * ECART_Y,
          l: LARGEUR_ALIEN,
          h: HAUTEUR_ALIEN,
          type: type,
          colonne: c,
          vivant: true
        });
      }
    }
    sens = 1;
    tirs = [];
    tirsAliens = [];
    recharge = 0;
    minuteurTirAlien = 1.5;
    tempsAnim = 0;
    image = 0;
    invincible = 0;
    banniere = { texte: 'VAGUE ' + vague, temps: 1.5 };
  }

  function majHud() {
    api.hud('SCORE ' + score, 'VAGUE ' + vague + '  VIES ' + vies);
  }

  /* ---------- Boucle ---------- */
  function miseAJour(dt) {
    Arcade.animerEtoiles(etoiles, dt, 0, 25, L, H);

    // 1. Le vaisseau
    const vitesseJoueur = 200;
    if (Arcade.controles.directionEnfoncee('gauche')) joueur.x -= vitesseJoueur * dt;
    if (Arcade.controles.directionEnfoncee('droite')) joueur.x += vitesseJoueur * dt;
    joueur.x = Arcade.limiter(joueur.x, 4, L - joueur.l - 4);

    // 2. Tir (on peut garder Espace enfoncé : tir automatique avec un temps de recharge)
    recharge -= dt;
    if (Arcade.controles.estEnfoncee('Space') && recharge <= 0 && tirs.length < 2) {
      tirs.push({ x: joueur.x + joueur.l / 2 - 1, y: joueur.y - 8, l: 3, h: 10 });
      recharge = 0.35;
    }

    // 3. Les tirs du joueur montent
    for (const t of tirs) t.y -= 440 * dt;
    tirs = tirs.filter(function (t) { return t.y + t.h > 0; });

    // 4. La formation d'aliens
    const vivants = aliens.filter(function (a) { return a.vivant; });
    const ratio = 1 - vivants.length / aliens.length;        // 0 au début, presque 1 à la fin
    const vitesseAliens = (22 + vague * 6) * (1 + ratio * 3); // plus ils sont rares, plus ils sont rapides
    const dx = sens * vitesseAliens * dt;
    const toucheBord = vivants.some(function (a) {
      return (sens > 0 && a.x + a.l + dx > L - 6) || (sens < 0 && a.x + dx < 6);
    });
    if (toucheBord) {
      sens = -sens;
      for (const a of vivants) a.y += 12; // un cran vers le bas
    } else {
      for (const a of vivants) a.x += dx;
    }

    tempsAnim += dt * (1 + ratio * 3);
    if (tempsAnim > 0.45) { tempsAnim = 0; image = 1 - image; }

    // 5. Les aliens tirent
    minuteurTirAlien -= dt;
    if (minuteurTirAlien <= 0 && vivants.length) {
      const tireur = alienLePlusBas(vivants);
      tirsAliens.push({ x: tireur.x + tireur.l / 2 - 1, y: tireur.y + tireur.h, l: 3, h: 9, vy: 160 + vague * 15 });
      minuteurTirAlien = Math.max(0.3, 1.3 - vague * 0.12) * (0.5 + Math.random());
    }
    for (const t of tirsAliens) t.y += t.vy * dt;
    tirsAliens = tirsAliens.filter(function (t) { return t.y < H; });

    // 6. Collisions : tirs du joueur → aliens
    for (const t of tirs) {
      for (const a of vivants) {
        if (a.vivant && !t.touche && Arcade.collision(t, a)) {
          a.vivant = false;
          t.touche = true;
          score += MODELES[a.type].points;
          ajouterExplosion(a.x + a.l / 2, a.y + a.h / 2, MODELES[a.type].couleur);
          majHud();
        }
      }
    }
    tirs = tirs.filter(function (t) { return !t.touche; });

    // 7. Collisions : tirs aliens → joueur
    if (invincible > 0) invincible -= dt;
    else {
      for (const t of tirsAliens) {
        if (Arcade.collision(t, joueur)) { etreTouche(); break; }
      }
    }

    // 8. Explosions
    for (const e of explosions) e.temps -= dt;
    explosions = explosions.filter(function (e) { return e.temps > 0; });

    if (banniere) {
      banniere.temps -= dt;
      if (banniere.temps <= 0) banniere = null;
    }

    // 9. Fin de vague ou invasion réussie ?
    if (!finie) {
      if (aliens.every(function (a) { return !a.vivant; })) {
        score += 100 * vague;
        vague++;
        nouvelleVague();
        majHud();
      } else if (aliens.some(function (a) { return a.vivant && a.y + a.h >= joueur.y - 4; })) {
        terminer('Les aliens ont atterri !');
      }
    }

    if (!finie) dessiner();
  }

  // Choisit une colonne au hasard, et l'alien le plus bas de cette colonne tire
  function alienLePlusBas(vivants) {
    const colonnesOccupees = [];
    vivants.forEach(function (a) {
      if (colonnesOccupees.indexOf(a.colonne) === -1) colonnesOccupees.push(a.colonne);
    });
    const col = colonnesOccupees[Math.floor(Math.random() * colonnesOccupees.length)];
    let plusBas = null;
    vivants.forEach(function (a) {
      if (a.colonne === col && (!plusBas || a.y > plusBas.y)) plusBas = a;
    });
    return plusBas;
  }

  function ajouterExplosion(x, y, couleur) {
    explosions.push({ x: x, y: y, couleur: couleur, temps: 0.4 });
  }

  function etreTouche() {
    vies--;
    majHud();
    ajouterExplosion(joueur.x + joueur.l / 2, joueur.y + joueur.h / 2, C.cyan);
    tirsAliens = [];
    if (vies <= 0) {
      terminer('Ton vaisseau a été détruit.');
    } else {
      invincible = 2; // 2 secondes d'invincibilité (le vaisseau clignote)
      banniere = { texte: 'VIES : ' + vies, temps: 1.2 };
    }
  }

  function terminer(details) {
    finie = true;
    boucle.arreter();
    dessiner();
    Arcade.texte(ctx, 'GAME OVER', L / 2, H / 2, 20, C.rose);
    minuteurFin = setTimeout(function () {
      api.fin({ valeur: score, titre: 'GAME OVER', details: details + ' Vague atteinte : ' + vague });
    }, 900);
  }

  /* ---------- Dessin ---------- */
  function dessiner() {
    ctx.fillStyle = Arcade.couleurs.fond;
    ctx.fillRect(0, 0, L, H);
    Arcade.dessinerEtoiles(ctx, etoiles);

    // Aliens
    for (const a of aliens) {
      if (a.vivant) Arcade.dessinerSprite(ctx, sprites[a.type][image], a.x, a.y);
    }

    // Vaisseau (il clignote quand il est invincible)
    const visible = invincible <= 0 || Math.floor(invincible * 10) % 2 === 0;
    if (visible && vies > 0) Arcade.dessinerSprite(ctx, sprites.vaisseau, joueur.x, joueur.y);

    // Tirs
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = C.cyan;
    ctx.fillStyle = '#ffffff';
    for (const t of tirs) ctx.fillRect(t.x, t.y, t.l, t.h);
    ctx.shadowColor = C.jaune;
    ctx.fillStyle = C.jaune;
    for (const t of tirsAliens) {
      // Un petit zigzag pour les tirs ennemis
      const decalage = Math.floor(t.y / 6) % 2 ? 1 : -1;
      ctx.fillRect(t.x + decalage, t.y, t.l, t.h);
    }
    ctx.restore();

    // Explosions : des carrés qui s'éloignent
    for (const e of explosions) {
      const rayon = (0.4 - e.temps) * 60;
      ctx.globalAlpha = e.temps / 0.4;
      ctx.fillStyle = e.couleur;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.fillRect(e.x + Math.cos(angle) * rayon - 2, e.y + Math.sin(angle) * rayon - 2, 4, 4);
      }
    }
    ctx.globalAlpha = 1;

    // Sol
    ctx.fillStyle = C.cyan;
    ctx.fillRect(0, H - 24, L, 2);

    if (banniere) Arcade.texte(ctx, banniere.texte, L / 2, H / 2 + 60, 14, C.jaune);
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
    id: 'invasion',
    nom: 'INVASION',
    couleur: Arcade.couleurs.rose,
    resume: 'Repousse les aliens',
    description: 'Détruis les vagues d\'aliens avant qu\'ils n\'atteignent le sol. Attention à leurs tirs !',
    icone: [
      '...#####...',
      '..#######..',
      '.##.###.##.',
      '.#########.',
      '..#.#.#.#..',
      '..#.#.#.#..',
      '.#..#.#..#.',
      '...........'
    ],
    controles: [
      ['GAUCHE DROITE / Q D', 'Déplacer le vaisseau'],
      ['Espace', 'Tirer (on peut rester appuyé)'],
      ['Mobile', 'Boutons ◀ FEU ▶ sous le jeu']
    ],
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter
  });
})();
