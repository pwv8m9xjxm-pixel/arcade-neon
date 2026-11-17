/* ==========================================================================
   ping-pong.js — Ping-Pong contre l'ordinateur
   --------------------------------------------------------------------------
   Le terrain est VERTICAL (pratique sur un téléphone tenu droit) :
   ta raquette est en bas, celle de l'ordinateur (l'« IA ») en haut.

   Règle : chaque point marqué rapporte 100, chaque renvoi 10. Après chacun
   de tes points, le niveau augmente : la balle va plus vite et l'IA devient
   plus forte. La partie s'arrête quand l'IA a marqué 5 points.

   L'IA : quand la balle monte vers elle, elle CALCULE où la balle va
   arriver (en tenant compte des rebonds sur les murs), puis se déplace
   vers ce point, avec une vitesse maximale et une petite erreur
   volontaire (sinon elle serait imbattable !).
   ========================================================================== */

(function () {
  const L = 360;
  const H = 540;
  const C = Arcade.couleurs;
  const POINTS_IA_MAX = 5;

  let api, canvas, ctx, boucle;
  let joueur, ia, balle;
  let pointsJoueur, pointsIA, renvois, score, niveau;
  let attenteService, sensService;
  let erreurIA;     // décalage volontaire de l'IA (en pixels)
  let cibleX;
  let banniere;
  let finie, minuteurFin;

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie) {
    api = apiPartie;
    const c = api.creerCanvas(L, H);
    canvas = c.canvas;
    ctx = c.ctx;

    joueur = { x: L / 2, y: H - 30, l: 72, h: 10 };
    ia = { x: L / 2, y: 30, l: 72, h: 10 };
    pointsJoueur = 0;
    pointsIA = 0;
    renvois = 0;
    score = 0;
    niveau = 1;
    cibleX = null;
    finie = false;
    banniere = null;
    erreurIA = 0;

    canvas.addEventListener('pointermove', suivrePointeur);
    canvas.addEventListener('pointerdown', suivrePointeur);

    servir(1);
    majHud();
    boucle = Arcade.creerBoucle(miseAJour);
    boucle.demarrer();
  }

  function suivrePointeur(e) {
    const rect = canvas.getBoundingClientRect();
    cibleX = (e.clientX - rect.left) * L / rect.width;
  }

  // Balle au centre ; elle part après 1 seconde (sens : 1 = vers toi, -1 = vers l'IA)
  function servir(sens) {
    balle = { x: L / 2, y: H / 2, vx: 0, vy: 0, r: 6 };
    attenteService = 1;
    sensService = sens;
  }

  function vitesseBalle() {
    return Math.min(260 + 22 * (niveau - 1), 520);
  }

  function vitesseIA() {
    return Math.min(190 + 28 * (niveau - 1), 520);
  }

  function majHud() {
    api.hud('SCORE ' + score, 'TOI ' + pointsJoueur + ' - ' + pointsIA + ' IA');
  }

  /* ---------- Prédiction de l'IA ----------
     Où sera la balle quand elle arrivera à la hauteur de l'IA ?
     On calcule sans les murs, puis on « replie » le résultat comme si la
     balle rebondissait sur les côtés (comme une feuille pliée en accordéon). */
  function predireX() {
    const yCible = ia.y + ia.h / 2 + balle.r;
    const t = (balle.y - yCible) / -balle.vy; // temps avant d'arriver (vy est négatif)
    const xLibre = balle.x + balle.vx * t;
    const min = balle.r;
    const largeur = L - 2 * balle.r;
    let p = (xLibre - min) % (2 * largeur);
    if (p < 0) p += 2 * largeur;
    return p <= largeur ? min + p : min + 2 * largeur - p;
  }

  /* ---------- Boucle ---------- */
  function miseAJour(dt) {
    // 1. Ta raquette
    const vitesseJoueur = 460;
    if (Arcade.controles.directionEnfoncee('gauche')) { joueur.x -= vitesseJoueur * dt; cibleX = null; }
    if (Arcade.controles.directionEnfoncee('droite')) { joueur.x += vitesseJoueur * dt; cibleX = null; }
    if (cibleX !== null) joueur.x = cibleX;
    joueur.x = Arcade.limiter(joueur.x, joueur.l / 2, L - joueur.l / 2);

    // 2. L'IA
    const cibleIA = balle.vy < 0 ? predireX() + erreurIA : L / 2;
    const ecart = cibleIA - ia.x;
    const pasMax = (balle.vy < 0 ? vitesseIA() : vitesseIA() * 0.4) * dt;
    ia.x += Arcade.limiter(ecart, -pasMax, pasMax);
    ia.x = Arcade.limiter(ia.x, ia.l / 2, L - ia.l / 2);

    // 3. Le service
    if (attenteService > 0) {
      attenteService -= dt;
      if (attenteService <= 0) {
        const angle = (Math.random() - 0.5) * 0.9;
        balle.vx = vitesseBalle() * Math.sin(angle);
        balle.vy = sensService * vitesseBalle() * Math.cos(angle);
        nouvelleErreurIA();
      }
    } else {
      deplacerBalle(dt);
    }

    if (banniere) {
      banniere.temps -= dt;
      if (banniere.temps <= 0) banniere = null;
    }

    if (!finie) dessiner();
  }

  // Plus le niveau est haut, plus l'IA vise juste
  function nouvelleErreurIA() {
    const imprecision = Math.max(6, 42 - niveau * 4);
    erreurIA = (Math.random() * 2 - 1) * imprecision;
  }

  // Rebond sur une raquette : l'angle dépend de l'endroit touché
  function rebondir(raquette, versLeBas) {
    const decalage = Arcade.limiter((balle.x - raquette.x) / (raquette.l / 2), -1, 1);
    const angle = decalage * (Math.PI / 3.2);
    const v = Math.min(Math.hypot(balle.vx, balle.vy) * 1.04, vitesseBalle() * 1.7);
    balle.vx = v * Math.sin(angle);
    balle.vy = (versLeBas ? 1 : -1) * v * Math.cos(angle);
  }

  function deplacerBalle(dt) {
    const distance = Math.hypot(balle.vx, balle.vy) * dt;
    const etapes = Math.max(1, Math.ceil(distance / 4));
    const pas = dt / etapes;

    for (let i = 0; i < etapes; i++) {
      balle.x += balle.vx * pas;
      balle.y += balle.vy * pas;

      // Murs gauche et droit
      if (balle.x - balle.r < 0) { balle.x = balle.r; balle.vx = Math.abs(balle.vx); }
      if (balle.x + balle.r > L) { balle.x = L - balle.r; balle.vx = -Math.abs(balle.vx); }

      // Ta raquette (en bas)
      const hautJoueur = joueur.y - joueur.h / 2;
      if (balle.vy > 0 && balle.y + balle.r >= hautJoueur && balle.y + balle.r <= hautJoueur + joueur.h + 6 &&
          Math.abs(balle.x - joueur.x) <= joueur.l / 2 + balle.r) {
        rebondir(joueur, false);
        balle.y = hautJoueur - balle.r;
        renvois++;
        score += 10;
        nouvelleErreurIA();
        majHud();
      }

      // Raquette de l'IA (en haut)
      const basIA = ia.y + ia.h / 2;
      if (balle.vy < 0 && balle.y - balle.r <= basIA && balle.y - balle.r >= basIA - ia.h - 6 &&
          Math.abs(balle.x - ia.x) <= ia.l / 2 + balle.r) {
        rebondir(ia, true);
        balle.y = basIA + balle.r;
      }

      // Point pour l'IA
      if (balle.y - balle.r > H) {
        pointsIA++;
        majHud();
        if (pointsIA >= POINTS_IA_MAX) { terminer(); return; }
        banniere = { texte: 'POINT IA', temps: 1 };
        servir(1);
        return;
      }

      // Point pour toi !
      if (balle.y + balle.r < 0) {
        pointsJoueur++;
        score += 100;
        niveau = 1 + pointsJoueur; // la difficulté augmente
        banniere = { texte: 'POINT ! NIVEAU ' + niveau, temps: 1.2 };
        majHud();
        servir(-1);
        return;
      }
    }
  }

  function terminer() {
    finie = true;
    boucle.arreter();
    dessiner();
    minuteurFin = setTimeout(function () {
      api.fin({
        valeur: score,
        titre: 'GAME OVER',
        details: 'Points marqués : ' + pointsJoueur + ' - Renvois : ' + renvois
      });
    }, 700);
  }

  /* ---------- Dessin ---------- */
  function dessiner() {
    ctx.fillStyle = Arcade.couleurs.fond;
    ctx.fillRect(0, 0, L, H);

    // Ligne du milieu en pointillés
    ctx.fillStyle = 'rgba(255, 43, 214, 0.35)';
    for (let x = 6; x < L; x += 24) ctx.fillRect(x, H / 2 - 2, 12, 4);

    // Gros scores en fond
    ctx.save();
    ctx.globalAlpha = 0.18;
    Arcade.texte(ctx, String(pointsIA), L / 2, H / 4, 48, C.rose);
    Arcade.texte(ctx, String(pointsJoueur), L / 2, (H * 3) / 4, 48, C.cyan);
    ctx.restore();

    // Raquettes et balle
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = C.rose;
    ctx.fillStyle = C.rose;
    ctx.fillRect(ia.x - ia.l / 2, ia.y - ia.h / 2, ia.l, ia.h);
    ctx.shadowColor = C.cyan;
    ctx.fillStyle = C.cyan;
    ctx.fillRect(joueur.x - joueur.l / 2, joueur.y - joueur.h / 2, joueur.l, joueur.h);
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(balle.x - balle.r, balle.y - balle.r, balle.r * 2, balle.r * 2); // balle carrée, très rétro
    ctx.restore();

    if (banniere) Arcade.texte(ctx, banniere.texte, L / 2, H / 2 - 40, 12, C.jaune);
    if (attenteService > 0 && !banniere) Arcade.texte(ctx, 'PRÊT ?', L / 2, H / 2 - 40, 12, C.jaune);
    if (finie) Arcade.texte(ctx, 'GAME OVER', L / 2, H / 2 - 40, 18, C.rose);
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
    id: 'ping-pong',
    nom: 'PING-PONG',
    couleur: Arcade.couleurs.cyan,
    resume: 'Bats l\'ordinateur',
    description: 'Renvoie la balle et marque contre l\'IA. Elle devient plus forte à chacun de tes points. Partie terminée quand elle a marqué 5 fois.',
    icone: [
      '..####..',
      '........',
      '........',
      '#.#.#.#.',
      '...#....',
      '........',
      '..####..',
      '........'
    ],
    controles: [
      ['GAUCHE DROITE / Q D', 'Déplacer ta raquette (en bas)'],
      ['Souris / doigt', 'Glisser pour déplacer la raquette']
    ],
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter
  });
})();
