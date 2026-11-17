/* ==========================================================================
   flappy.js — Flappy (un oiseau pixel entre des colonnes néon)
   --------------------------------------------------------------------------
   Règle : l'oiseau tombe tout seul (gravité). Chaque battement d'ailes le
   fait remonter. Il faut passer dans les trous des colonnes sans les
   toucher. Chaque colonne passée = 1 point. Plus on avance, plus ça va
   vite et plus les trous sont petits.

   Notions importantes :
   - la gravité : à chaque image, la vitesse verticale augmente
     (vy += GRAVITE × dt), puis la position suit (y += vy × dt).
   - un battement d'ailes remplace la vitesse par une valeur vers le haut.
   - les « états » : 'attente' (avant le 1er battement), 'vol', 'chute'
     (on vient de se cogner) et 'fini'.
   ========================================================================== */

(function () {
  const L = 360;
  const H = 540;
  const SOL = H - 40;            // hauteur du sol
  const GRAVITE = 1400;          // pixels / seconde²
  const IMPULSION = -420;        // vitesse donnée par un battement (négatif = vers le haut)
  const LARGEUR_COLONNE = 56;
  const ESPACEMENT = 200;        // distance entre deux colonnes
  const C = Arcade.couleurs;

  // L'oiseau en pixels : Y = jaune, W = blanc, K = noir (œil), O = orange (bec)
  const PALETTE = { Y: C.jaune, W: '#ffffff', K: '#000010', O: C.orange, lueur: C.jaune };
  const OISEAU_AILES_HAUT = [
    '....YYYYY...',
    '.WWYYYYWWW..',
    'WWWWYYWWWKW.',
    'WWWWYYWWWKW.',
    '.WWYYYYWWWW.',
    '.YYYYYYYOOOO',
    '.YYYYYYOOOO.',
    '..YYYYYYOOO.',
    '....YYYYY...'
  ];
  const OISEAU_AILES_BAS = [
    '....YYYYY...',
    '..YYYYYWWW..',
    '.YYYYYWWWKW.',
    'YYYYYYWWWKW.',
    '.YYYYYYWWWW.',
    'WWWWYYYYOOOO',
    'WWWWYYYOOOO.',
    '.WWYYYYYOOO.',
    '....YYYYY...'
  ];

  let api, ctx, boucle;
  let spriteHaut, spriteBas;
  let oiseau, colonnes, score, etat, temps, decalageSol, etoiles, flash;
  let minuteurFin;

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie) {
    api = apiPartie;
    ctx = api.creerCanvas(L, H).ctx;

    // Les sprites ne sont fabriqués qu'une fois
    if (!spriteHaut) {
      spriteHaut = Arcade.sprite(OISEAU_AILES_HAUT, PALETTE, 3, 6);
      spriteBas = Arcade.sprite(OISEAU_AILES_BAS, PALETTE, 3, 6);
    }

    oiseau = { x: 90, y: H / 2 - 40, vy: 0 };
    colonnes = [];
    score = 0;
    etat = 'attente';
    temps = 0;
    decalageSol = 0;
    flash = 0;
    etoiles = Arcade.creerEtoiles(50, L, SOL);
    majHud();

    boucle = Arcade.creerBoucle(miseAJour);
    boucle.demarrer();
  }

  function majHud() {
    api.hud('SCORE ' + score, 'VITESSE ' + (1 + Math.floor(score / 5)));
  }

  // La difficulté dépend du score
  function vitesse() { return Math.min(150 + score * 4, 270); }
  function tailleTrou() { return Math.max(118, 165 - score * 2); }

  /* ---------- Battement d'ailes ---------- */
  function battre() {
    if (etat === 'attente') etat = 'vol';
    if (etat === 'vol') oiseau.vy = IMPULSION;
  }

  /* ---------- Colonnes ---------- */
  function ajouterColonne() {
    const trou = tailleTrou();
    const marge = 60;
    colonnes.push({
      x: L + 10,
      trouY: marge + trou / 2 + Math.random() * (SOL - 2 * marge - trou), // centre du trou
      trou: trou,
      passee: false
    });
  }

  // La « boîte de collision » de l'oiseau, un peu plus petite que le dessin (plus juste)
  function boiteOiseau() {
    return { x: oiseau.x - 14, y: oiseau.y - 10, l: 28, h: 20 };
  }

  /* ---------- Boucle ---------- */
  function miseAJour(dt) {
    temps += dt;
    if (flash > 0) flash -= dt;

    if (etat === 'attente') {
      // L'oiseau flotte doucement en attendant le premier battement
      oiseau.y = H / 2 - 40 + Math.sin(temps * 4) * 8;
    } else {
      oiseau.vy += GRAVITE * dt;
      oiseau.y += oiseau.vy * dt;
      if (oiseau.y < 0) { oiseau.y = 0; oiseau.vy = 0; } // plafond
    }

    if (etat === 'attente' || etat === 'vol') {
      decalageSol = (decalageSol + vitesse() * dt) % 24;
      Arcade.animerEtoiles(etoiles, dt, -20, 0, L, SOL);
    }

    if (etat === 'vol') {
      const v = vitesse();
      for (const col of colonnes) col.x -= v * dt;
      colonnes = colonnes.filter(function (col) { return col.x > -LARGEUR_COLONNE; });
      const derniere = colonnes[colonnes.length - 1];
      if (!derniere || derniere.x < L - ESPACEMENT) ajouterColonne();

      const boite = boiteOiseau();
      for (const col of colonnes) {
        // Point gagné quand on a dépassé la colonne
        if (!col.passee && col.x + LARGEUR_COLONNE < oiseau.x) {
          col.passee = true;
          score++;
          majHud();
        }
        // Collision avec la partie haute ou basse de la colonne
        const haut = { x: col.x, y: -100, l: LARGEUR_COLONNE, h: col.trouY - col.trou / 2 + 100 };
        const bas = { x: col.x, y: col.trouY + col.trou / 2, l: LARGEUR_COLONNE, h: SOL };
        if (Arcade.collision(boite, haut) || Arcade.collision(boite, bas)) {
          seCogner();
          break;
        }
      }
    }

    // Le sol
    if (oiseau.y + 10 >= SOL) {
      oiseau.y = SOL - 10;
      if (etat === 'vol') seCogner();
      if (etat === 'chute') atterrir();
    }

    dessiner();
  }

  function seCogner() {
    etat = 'chute';
    flash = 0.15;
    if (oiseau.vy < 0) oiseau.vy = 0;
  }

  function atterrir() {
    etat = 'fini';
    boucle.arreter();
    dessiner();
    minuteurFin = setTimeout(function () {
      api.fin({ valeur: score, titre: 'AÏE !', details: 'Colonnes franchies : ' + score });
    }, 600);
  }

  /* ---------- Dessin ---------- */
  function dessiner() {
    // Ciel : dégradé violet → noir
    const degrade = ctx.createLinearGradient(0, 0, 0, SOL);
    degrade.addColorStop(0, '#0a0024');
    degrade.addColorStop(1, '#2a0845');
    ctx.fillStyle = degrade;
    ctx.fillRect(0, 0, L, H);
    Arcade.dessinerEtoiles(ctx, etoiles);

    // Colonnes néon
    ctx.lineWidth = 3;
    for (const col of colonnes) {
      const yHaut = col.trouY - col.trou / 2;
      const yBas = col.trouY + col.trou / 2;
      ctx.fillStyle = 'rgba(57, 255, 20, 0.15)';
      ctx.fillRect(col.x, 0, LARGEUR_COLONNE, yHaut);
      ctx.fillRect(col.x, yBas, LARGEUR_COLONNE, SOL - yBas);
      ctx.save();
      ctx.shadowColor = C.vert;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = C.vert;
      ctx.strokeRect(col.x, -5, LARGEUR_COLONNE, yHaut + 5);
      ctx.strokeRect(col.x, yBas, LARGEUR_COLONNE, SOL - yBas + 5);
      // Les « chapeaux » au bord du trou
      ctx.fillStyle = C.vert;
      ctx.fillRect(col.x - 5, yHaut - 12, LARGEUR_COLONNE + 10, 12);
      ctx.fillRect(col.x - 5, yBas, LARGEUR_COLONNE + 10, 12);
      ctx.restore();
    }

    // Sol avec une grille qui défile
    ctx.fillStyle = '#12002a';
    ctx.fillRect(0, SOL, L, H - SOL);
    ctx.fillStyle = C.rose;
    ctx.fillRect(0, SOL, L, 3);
    ctx.fillStyle = 'rgba(255, 43, 214, 0.4)';
    for (let x = -decalageSol; x < L; x += 24) ctx.fillRect(Math.round(x), SOL + 3, 2, H - SOL);

    // L'oiseau, penché selon sa vitesse
    const sprite = (etat === 'vol' && oiseau.vy < 0) || (etat === 'attente' && Math.sin(temps * 12) > 0) ? spriteBas : spriteHaut;
    const angle = etat === 'attente' ? 0 : Arcade.limiter(oiseau.vy / 600, -0.5, 1.3);
    ctx.save();
    ctx.translate(oiseau.x, oiseau.y);
    ctx.rotate(angle);
    Arcade.dessinerSprite(ctx, sprite, -18, -14);
    ctx.restore();

    // Textes
    if (etat === 'attente') {
      Arcade.texte(ctx, 'TOUCHE OU ESPACE', L / 2, H / 2 + 50, 11, C.cyan);
      Arcade.texte(ctx, 'POUR VOLER', L / 2, H / 2 + 72, 11, C.cyan);
    } else {
      Arcade.texte(ctx, String(score), L / 2, 50, 28, '#ffffff');
    }

    // Éclair blanc quand on se cogne
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (flash * 4) + ')';
      ctx.fillRect(0, 0, L, H);
    }
  }

  /* ---------- Contrôles ---------- */
  function touche(code, e) {
    if (e.repeat) return; // garder la touche enfoncée ne fait pas battre en boucle
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') battre();
  }

  function appui() {
    battre();
  }

  /* ---------- Pause / arrêt ---------- */
  function pause() { if (boucle) boucle.arreter(); }
  function reprendre() { if (boucle && etat !== 'fini') boucle.demarrer(); }
  function arreter() {
    if (boucle) boucle.arreter();
    clearTimeout(minuteurFin);
  }

  /* ---------- Inscription ---------- */
  Arcade.enregistrerJeu({
    id: 'flappy',
    nom: 'FLAPPY',
    couleur: Arcade.couleurs.rouge,
    resume: 'Vole entre les colonnes',
    description: 'Fais battre des ailes l\'oiseau pour passer entre les colonnes. Une seule touche, mais ça demande du rythme !',
    icone: [
      '........',
      '..###...',
      '.####.#.',
      '#######.',
      '#####.##',
      '.######.',
      '..####..',
      '........'
    ],
    controles: [
      ['ESPACE / HAUT / Z', 'Battre des ailes'],
      ['Clic / toucher', 'Battre des ailes']
    ],
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter,
    touche: touche,
    appui: appui
  });
})();
