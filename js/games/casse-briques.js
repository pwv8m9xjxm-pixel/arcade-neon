/* ==========================================================================
   casse-briques.js — Casse-briques
   --------------------------------------------------------------------------
   Règle : on renvoie la balle avec la raquette pour détruire toutes les
   briques. Si la balle tombe, on perd une vie (3 au départ). Chaque niveau
   terminé en amène un nouveau, avec plus de briques, des briques solides
   (2 coups) et une balle plus rapide.

   Notions importantes :
   - la balle a une position (x, y) et une vitesse (vx, vy) en pixels/seconde,
   - à chaque image : position += vitesse × dt,
   - rebond sur un mur = on inverse vx ou vy,
   - pour ne pas « traverser » une brique quand la balle va vite, on découpe
     chaque déplacement en petits pas (des « sous-étapes »).
   ========================================================================== */

(function () {
  const L = 360;
  const H = 520;
  const C = Arcade.couleurs;

  const COLONNES = 8;
  const MARGE = 12;           // espace à gauche et à droite des briques
  const ECART = 4;            // espace entre deux briques
  const HAUTEUR_BRIQUE = 16;
  const HAUT_BRIQUES = 60;    // position de la première rangée
  const COULEURS_RANGEES = [C.rose, C.orange, C.jaune, C.vert, C.cyan, C.bleu, C.violet, C.rose, C.orange];

  let api, canvas, ctx, boucle;
  let raquette, balle, briques, particules;
  let vies, niveau, score, vitesse;
  let cibleX;       // position voulue par la souris / le doigt (null = clavier)
  let banniere;     // texte affiché au milieu (« NIVEAU 2 »…)
  let finie, minuteurFin;

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie) {
    api = apiPartie;
    const c = api.creerCanvas(L, H);
    canvas = c.canvas;
    ctx = c.ctx;

    vies = 3;
    niveau = 1;
    score = 0;
    particules = [];
    finie = false;
    cibleX = null;
    raquette = { x: L / 2, y: H - 36, l: 72, h: 10 }; // x, y = centre de la raquette

    // La raquette suit la souris ou le doigt
    canvas.addEventListener('pointermove', suivrePointeur);
    canvas.addEventListener('pointerdown', suivrePointeur);

    nouveauNiveau();
    majHud();
    boucle = Arcade.creerBoucle(miseAJour);
    boucle.demarrer();
  }

  // Convertit la position du doigt (en pixels de l'écran) en position dans le jeu
  function suivrePointeur(e) {
    const rect = canvas.getBoundingClientRect();
    cibleX = (e.clientX - rect.left) * L / rect.width;
  }

  function nouveauNiveau() {
    briques = [];
    const rangees = Math.min(4 + niveau, 9);
    const largeur = (L - 2 * MARGE - (COLONNES - 1) * ECART) / COLONNES;
    for (let r = 0; r < rangees; r++) {
      for (let col = 0; col < COLONNES; col++) {
        // À partir du niveau 3, les rangées du haut sont « solides » (2 coups)
        const solide = niveau >= 3 && r < Math.min(niveau - 2, 3);
        briques.push({
          x: MARGE + col * (largeur + ECART),
          y: HAUT_BRIQUES + r * (HAUTEUR_BRIQUE + ECART),
          l: largeur,
          h: HAUTEUR_BRIQUE,
          vie: solide ? 2 : 1,
          couleur: COULEURS_RANGEES[r]
        });
      }
    }
    vitesse = Math.min(300 + (niveau - 1) * 35, 560);
    banniere = { texte: 'NIVEAU ' + niveau, temps: 1.5 };
    collerBalle();
  }

  // La balle attend sur la raquette qu'on la lance
  function collerBalle() {
    balle = { x: raquette.x, y: raquette.y - 12, vx: 0, vy: 0, r: 6, collee: true };
  }

  function lancer() {
    if (!balle.collee || finie) return;
    const angle = (Math.random() * 0.6 - 0.3); // un peu de hasard (en radians)
    balle.vx = vitesse * Math.sin(angle);
    balle.vy = -vitesse * Math.cos(angle);
    balle.collee = false;
  }

  function majHud() {
    api.hud('SCORE ' + score, 'NIV ' + niveau + '  VIES ' + vies);
  }

  /* ---------- Boucle ---------- */
  function miseAJour(dt) {
    // 1. La raquette
    const vitesseRaquette = 480;
    if (Arcade.controles.directionEnfoncee('gauche')) { raquette.x -= vitesseRaquette * dt; cibleX = null; }
    if (Arcade.controles.directionEnfoncee('droite')) { raquette.x += vitesseRaquette * dt; cibleX = null; }
    if (cibleX !== null) raquette.x = cibleX;
    raquette.x = Arcade.limiter(raquette.x, raquette.l / 2, L - raquette.l / 2);

    // 2. La balle
    if (balle.collee) {
      balle.x = raquette.x;
      balle.y = raquette.y - raquette.h / 2 - balle.r - 1;
    } else {
      deplacerBalle(dt);
    }

    // 3. Les particules (petits éclats des briques cassées)
    for (const p of particules) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt; // gravité
      p.vie -= dt;
    }
    particules = particules.filter(function (p) { return p.vie > 0; });

    if (banniere) {
      banniere.temps -= dt;
      if (banniere.temps <= 0) banniere = null;
    }

    if (!finie) dessiner();
  }

  function deplacerBalle(dt) {
    const distance = Math.hypot(balle.vx, balle.vy) * dt;
    const etapes = Math.max(1, Math.ceil(distance / 4)); // pas de plus de 4 px à la fois
    const pas = dt / etapes;

    for (let i = 0; i < etapes; i++) {
      balle.x += balle.vx * pas;
      balle.y += balle.vy * pas;

      // Murs gauche, droit et haut
      if (balle.x - balle.r < 0) { balle.x = balle.r; balle.vx = Math.abs(balle.vx); }
      if (balle.x + balle.r > L) { balle.x = L - balle.r; balle.vx = -Math.abs(balle.vx); }
      if (balle.y - balle.r < 0) { balle.y = balle.r; balle.vy = Math.abs(balle.vy); }

      // Raquette : l'angle du rebond dépend de l'endroit touché
      const hautRaquette = raquette.y - raquette.h / 2;
      if (balle.vy > 0 &&
          balle.y + balle.r >= hautRaquette &&
          balle.y + balle.r <= hautRaquette + raquette.h + 6 &&
          Math.abs(balle.x - raquette.x) <= raquette.l / 2 + balle.r) {
        // -1 = bord gauche, 0 = milieu, +1 = bord droit
        const decalage = Arcade.limiter((balle.x - raquette.x) / (raquette.l / 2), -1, 1);
        const angle = decalage * (Math.PI / 3); // jusqu'à 60° d'inclinaison
        const v = Math.min(Math.hypot(balle.vx, balle.vy) + 5, 680); // accélère un peu
        balle.vx = v * Math.sin(angle);
        balle.vy = -v * Math.cos(angle);
        balle.y = hautRaquette - balle.r;
      }

      // Briques
      if (toucherBrique()) {
        if (briques.every(function (b) { return b.vie <= 0; })) {
          score += 100 * niveau; // bonus de fin de niveau
          niveau++;
          nouveauNiveau();
          majHud();
          return;
        }
      }

      // La balle est tombée
      if (balle.y - balle.r > H) {
        perdreVie();
        return;
      }
    }
  }

  /* Collision cercle / rectangle : on cherche le point de la brique le plus
     proche du centre de la balle. S'il est à moins d'un rayon, ça touche. */
  function toucherBrique() {
    for (const b of briques) {
      if (b.vie <= 0) continue;
      const px = Arcade.limiter(balle.x, b.x, b.x + b.l);
      const py = Arcade.limiter(balle.y, b.y, b.y + b.h);
      const dx = balle.x - px;
      const dy = balle.y - py;
      if (dx * dx + dy * dy > balle.r * balle.r) continue;

      // On rebondit sur le côté le plus « frappé » et on ressort la balle de la brique
      if (Math.abs(dx) > Math.abs(dy)) {
        balle.vx = dx > 0 ? Math.abs(balle.vx) : -Math.abs(balle.vx);
        balle.x = px + (dx > 0 ? balle.r : -balle.r);
      } else {
        const versLeBas = dy > 0 || (dy === 0 && balle.vy < 0);
        balle.vy = versLeBas ? Math.abs(balle.vy) : -Math.abs(balle.vy);
        balle.y = py + (versLeBas ? balle.r : -balle.r);
      }

      b.vie--;
      if (b.vie <= 0) {
        score += 10 * niveau;
        exploser(b);
      } else {
        score += 5;
      }
      majHud();
      return true; // une seule brique par sous-étape
    }
    return false;
  }

  function exploser(b) {
    for (let i = 0; i < 8; i++) {
      particules.push({
        x: b.x + b.l / 2,
        y: b.y + b.h / 2,
        vx: (Math.random() - 0.5) * 240,
        vy: (Math.random() - 0.8) * 200,
        vie: 0.5,
        couleur: b.couleur
      });
    }
  }

  function perdreVie() {
    vies--;
    majHud();
    if (vies <= 0) {
      finie = true;
      boucle.arreter();
      dessiner();
      minuteurFin = setTimeout(function () {
        api.fin({ valeur: score, titre: 'GAME OVER', details: 'Niveau atteint : ' + niveau });
      }, 700);
    } else {
      banniere = { texte: 'VIES : ' + vies, temps: 1.2 };
      collerBalle();
    }
  }

  /* ---------- Dessin ---------- */
  function dessiner() {
    ctx.fillStyle = Arcade.couleurs.fond;
    ctx.fillRect(0, 0, L, H);

    // Briques : un « tube néon » = contour vif + intérieur transparent
    ctx.lineWidth = 2;
    for (const b of briques) {
      if (b.vie <= 0) continue;
      ctx.globalAlpha = b.vie === 2 ? 0.7 : 0.25;
      ctx.fillStyle = b.couleur;
      ctx.fillRect(b.x, b.y, b.l, b.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = b.vie === 2 ? '#ffffff' : b.couleur;
      ctx.strokeRect(b.x + 1, b.y + 1, b.l - 2, b.h - 2);
    }

    // Particules
    for (const p of particules) {
      ctx.globalAlpha = Math.max(0, p.vie * 2);
      ctx.fillStyle = p.couleur;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Raquette et balle, avec une lueur
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = C.cyan;
    ctx.fillStyle = C.cyan;
    ctx.fillRect(raquette.x - raquette.l / 2, raquette.y - raquette.h / 2, raquette.l, raquette.h);
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(balle.x, balle.y, balle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (banniere) Arcade.texte(ctx, banniere.texte, L / 2, H / 2 + 40, 16, C.jaune);
    if (balle.collee && !finie) Arcade.texte(ctx, 'ESPACE / TOUCHE : LANCER', L / 2, H - 80, 8, C.cyan);
    if (finie) Arcade.texte(ctx, 'GAME OVER', L / 2, H / 2 + 40, 18, C.rose);
  }

  /* ---------- Contrôles ---------- */
  function touche(code) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') lancer();
  }

  function tape() {
    lancer();
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
    id: 'casse-briques',
    nom: 'CASSE-BRIQUES',
    couleur: Arcade.couleurs.orange,
    resume: 'Détruis toutes les briques',
    description: 'Renvoie la balle avec la raquette pour casser toutes les briques. Le bord de la raquette renvoie la balle en biais !',
    icone: [
      '###.###.',
      '........',
      '.###.###',
      '........',
      '....#...',
      '........',
      '..####..',
      '........'
    ],
    controles: [
      ['GAUCHE DROITE / Q D', 'Déplacer la raquette'],
      ['Souris / doigt', 'Glisser pour déplacer la raquette'],
      ['Espace / toucher', 'Lancer la balle']
    ],
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter,
    touche: touche,
    tape: tape
  });
})();
