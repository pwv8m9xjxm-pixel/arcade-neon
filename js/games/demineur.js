/* ==========================================================================
   demineur.js — Démineur (3 niveaux, classement au meilleur temps)
   --------------------------------------------------------------------------
   Règle : des mines sont cachées sous les cases. Quand on découvre une case,
   un chiffre indique combien de mines la touchent (y compris en diagonale).
   On pose des drapeaux sur les mines devinées. On gagne quand toutes les
   cases sans mine sont découvertes. Le plus rapide est le meilleur !

   Particularités :
   - le premier clic n'est JAMAIS une mine (les mines sont placées après),
   - une case « 0 » découvre automatiquement ses voisines (« propagation »),
   - cliquer sur un chiffre dont tous les drapeaux sont posés découvre les
     voisines restantes (pratique pour aller vite).

   Comme 2048, ce jeu utilise des <div> et pas de canvas : chaque case est
   un élément HTML qui réagit aux clics.
   ========================================================================== */

(function () {
  const NIVEAUX = {
    facile:    { lignes: 9,  colonnes: 9,  mines: 10, nom: 'FACILE' },
    moyen:     { lignes: 12, colonnes: 12, mines: 24, nom: 'MOYEN' },
    difficile: { lignes: 16, colonnes: 16, mines: 40, nom: 'DIFFICILE' }
  };
  const DUREE_APPUI_LONG = 450; // millisecondes

  let api, plateau, idNiveau, niveau;
  let cases;             // tableau de toutes les cases (de gauche à droite, ligne par ligne)
  let minesPlacees, finie, enPause, modeDrapeau;
  let debut, tempsCumule, chronoEnMarche, minuteurHud, minuteurFin;
  let boutonDrapeau;
  let appui = null;      // l'appui en cours (pour détecter l'appui long)
  let dernierPointeur = 'mouse';

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie, option) {
    api = apiPartie;
    idNiveau = NIVEAUX[option] ? option : 'facile';
    niveau = NIVEAUX[idNiveau];
    minesPlacees = false;
    finie = false;
    enPause = false;
    modeDrapeau = false;
    tempsCumule = 0;
    chronoEnMarche = false;

    plateau = document.createElement('div');
    plateau.className = 'plateau-demineur';
    plateau.style.setProperty('--colonnes', niveau.colonnes);
    plateau.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // pas de menu du clic droit

    cases = [];
    for (let l = 0; l < niveau.lignes; l++) {
      for (let c = 0; c < niveau.colonnes; c++) {
        const el = document.createElement('div');
        el.className = 'case-dem';
        const caseJeu = { l: l, c: c, mine: false, voisines: 0, revelee: false, drapeau: false, el: el };
        brancherCase(caseJeu);
        cases.push(caseJeu);
        plateau.appendChild(el);
      }
    }
    zone.appendChild(plateau);
    api.ajuster(plateau, niveau.colonnes, niveau.lignes);

    // Bouton « mode drapeau » pour les écrans tactiles
    boutonDrapeau = document.createElement('button');
    boutonDrapeau.type = 'button';
    boutonDrapeau.className = 'bouton-tactile';
    boutonDrapeau.addEventListener('click', function () {
      modeDrapeau = !modeDrapeau;
      majBoutonDrapeau();
    });
    api.zoneTactile.appendChild(boutonDrapeau);
    majBoutonDrapeau();

    majHud();
  }

  function majBoutonDrapeau() {
    boutonDrapeau.textContent = modeDrapeau ? '🚩 DRAPEAU : OUI' : '🚩 DRAPEAU : NON';
    boutonDrapeau.classList.toggle('actif', modeDrapeau);
  }

  /* ---------- Clics, appui long, clic droit ----------
     - clic gauche / toucher court  → découvrir (ou drapeau si le mode est activé)
     - clic droit / appui long      → poser ou enlever un drapeau */
  function brancherCase(caseJeu) {
    const el = caseJeu.el;

    el.addEventListener('pointerdown', function (e) {
      if (finie || enPause) return;
      dernierPointeur = e.pointerType;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      annulerAppui();
      appui = { caseJeu: caseJeu, x: e.clientX, y: e.clientY, long: false };
      appui.minuteur = setTimeout(function () {
        if (!appui) return;
        appui.long = true;
        basculerDrapeau(caseJeu);
        if (navigator.vibrate) navigator.vibrate(30); // petite vibration (Android)
      }, DUREE_APPUI_LONG);
    });

    el.addEventListener('pointermove', function (e) {
      // Si le doigt bouge trop, ce n'est plus un appui
      if (appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 12) annulerAppui();
    });

    el.addEventListener('pointerup', function () {
      if (!appui || appui.caseJeu !== caseJeu) return;
      const etaitLong = appui.long;
      annulerAppui();
      if (!etaitLong) actionPrincipale(caseJeu);
    });

    el.addEventListener('pointercancel', annulerAppui);
    el.addEventListener('pointerleave', annulerAppui);

    // Clic droit (souris seulement : sur Android, l'appui long déclenche aussi
    // « contextmenu », mais on l'a déjà traité avec le minuteur)
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (dernierPointeur === 'mouse' && !finie && !enPause) basculerDrapeau(caseJeu);
    });
  }

  function annulerAppui() {
    if (appui) clearTimeout(appui.minuteur);
    appui = null;
  }

  function actionPrincipale(caseJeu) {
    if (finie || enPause) return;
    if (modeDrapeau && !caseJeu.revelee) basculerDrapeau(caseJeu);
    else if (caseJeu.revelee) accord(caseJeu);
    else reveler(caseJeu);
  }

  /* ---------- Logique ---------- */
  function caseEn(l, c) {
    if (l < 0 || l >= niveau.lignes || c < 0 || c >= niveau.colonnes) return null;
    return cases[l * niveau.colonnes + c];
  }

  // Les 8 cases autour (moins sur les bords)
  function voisines(caseJeu) {
    const liste = [];
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dl === 0 && dc === 0) continue;
        const v = caseEn(caseJeu.l + dl, caseJeu.c + dc);
        if (v) liste.push(v);
      }
    }
    return liste;
  }

  // Place les mines APRÈS le premier clic, loin de la case cliquée
  function placerMines(premiere) {
    const interdites = voisines(premiere).concat([premiere]);
    const candidates = cases.filter(function (k) { return interdites.indexOf(k) === -1; });
    for (let i = 0; i < niveau.mines; i++) {
      const index = Math.floor(Math.random() * candidates.length);
      candidates[index].mine = true;
      candidates.splice(index, 1); // on la retire pour ne pas la choisir deux fois
    }
    // On compte les mines autour de chaque case
    for (const k of cases) {
      k.voisines = voisines(k).filter(function (v) { return v.mine; }).length;
    }
    minesPlacees = true;
    demarrerChrono();
  }

  function reveler(caseJeu) {
    if (caseJeu.revelee || caseJeu.drapeau) return;
    if (!minesPlacees) placerMines(caseJeu);

    if (caseJeu.mine) {
      exploser(caseJeu);
      return;
    }

    // Propagation : on utilise une « pile » de cases à traiter
    const pile = [caseJeu];
    while (pile.length) {
      const k = pile.pop();
      if (k.revelee || k.drapeau) continue;
      k.revelee = true;
      dessinerCase(k);
      if (k.voisines === 0) {
        voisines(k).forEach(function (v) {
          if (!v.revelee && !v.mine) pile.push(v);
        });
      }
    }
    verifierVictoire();
  }

  // Clic sur un chiffre : si assez de drapeaux autour, on découvre le reste
  function accord(caseJeu) {
    if (caseJeu.voisines === 0) return;
    const autour = voisines(caseJeu);
    const drapeaux = autour.filter(function (v) { return v.drapeau; }).length;
    if (drapeaux !== caseJeu.voisines) return;
    autour.forEach(function (v) {
      if (!finie && !v.revelee && !v.drapeau) reveler(v);
    });
  }

  function basculerDrapeau(caseJeu) {
    if (caseJeu.revelee || finie) return;
    caseJeu.drapeau = !caseJeu.drapeau;
    dessinerCase(caseJeu);
    majHud();
  }

  function verifierVictoire() {
    const aDecouvrir = cases.filter(function (k) { return !k.mine && !k.revelee; }).length;
    if (aDecouvrir > 0) return;
    finie = true;
    arreterChrono();
    // On pose automatiquement les drapeaux restants
    cases.forEach(function (k) {
      if (k.mine) { k.drapeau = true; dessinerCase(k); }
    });
    majHud();
    const temps = Math.round(tempsEcoule());
    minuteurFin = setTimeout(function () {
      api.fin({
        valeur: temps,
        cle: 'demineur-' + idNiveau,
        titre: 'DÉMINÉ !',
        details: 'Niveau ' + niveau.nom + ' réussi.'
      });
    }, 700);
  }

  function exploser(caseJeu) {
    finie = true;
    arreterChrono();
    caseJeu.el.classList.add('explosee');
    // On montre toutes les mines, et les drapeaux qui étaient faux
    cases.forEach(function (k) {
      if (k.mine && !k.drapeau) { k.el.textContent = '💣'; k.el.classList.add('revelee'); }
      if (!k.mine && k.drapeau) k.el.textContent = '❌';
    });
    caseJeu.el.classList.remove('revelee');
    minuteurFin = setTimeout(function () {
      // valeur: null → pas de classement (on a perdu)
      api.fin({ valeur: null, cle: 'demineur-' + idNiveau, titre: 'BOUM !', details: 'Tu as touché une mine. Réessaie !' });
    }, 1200);
  }

  /* ---------- Chronomètre ----------
     On mémorise l'heure de départ ; le temps écoulé = maintenant - départ.
     En pause, on met de côté le temps déjà écoulé (tempsCumule). */
  function demarrerChrono() {
    debut = performance.now();
    chronoEnMarche = true;
    clearInterval(minuteurHud);
    minuteurHud = setInterval(majHud, 100); // le HUD est rafraîchi 10 fois par seconde
  }

  function arreterChrono() {
    if (chronoEnMarche) tempsCumule += performance.now() - debut;
    chronoEnMarche = false;
    clearInterval(minuteurHud);
  }

  function tempsEcoule() {
    return tempsCumule + (chronoEnMarche ? performance.now() - debut : 0);
  }

  /* ---------- Affichage ---------- */
  function dessinerCase(k) {
    const el = k.el;
    el.className = 'case-dem';
    el.textContent = '';
    if (k.revelee) {
      el.classList.add('revelee');
      if (k.voisines > 0) {
        el.textContent = k.voisines;
        el.classList.add('n' + k.voisines);
      }
    } else if (k.drapeau) {
      el.textContent = '🚩';
    }
  }

  function majHud() {
    const drapeaux = cases.filter(function (k) { return k.drapeau; }).length;
    api.hud('MINES ' + (niveau.mines - drapeaux), 'TEMPS ' + Arcade.scores.formater(tempsEcoule(), 'temps'));
  }

  /* ---------- Pause / arrêt ---------- */
  function pause() {
    enPause = true;
    annulerAppui();
    arreterChrono();
  }
  function reprendre() {
    enPause = false;
    if (minesPlacees && !finie) demarrerChrono();
  }
  function arreter() {
    annulerAppui();
    arreterChrono();
    clearTimeout(minuteurFin);
    finie = true;
  }

  /* ---------- Inscription ---------- */
  Arcade.enregistrerJeu({
    id: 'demineur',
    nom: 'DÉMINEUR',
    couleur: Arcade.couleurs.bleu,
    resume: 'Évite les mines',
    description: 'Découvre toutes les cases sans mine. Les chiffres indiquent combien de mines touchent la case. Le plus rapide gagne !',
    icone: [
      '...#....',
      '.#.#.#..',
      '..###...',
      '#######.',
      '..###...',
      '.#.#.#..',
      '...#....',
      '........'
    ],
    controles: [
      ['Clic gauche', 'Découvrir une case'],
      ['Clic droit', 'Poser / enlever un drapeau'],
      ['Clic sur un chiffre', 'Découvrir autour (si drapeaux posés)'],
      ['Mobile', 'Toucher = découvrir, appui long = drapeau, ou bouton DRAPEAU']
    ],
    // Choix proposé sur l'écran de départ
    options: {
      titre: 'NIVEAU',
      choix: [
        { id: 'facile', texte: 'FACILE 9×9' },
        { id: 'moyen', texte: 'MOYEN 12×12' },
        { id: 'difficile', texte: 'DIFFICILE 16×16' }
      ]
    },
    // Un classement par niveau, au meilleur temps (plus petit = meilleur)
    classements: [
      { cle: 'demineur-facile', titre: 'FACILE', ordre: 'petit', format: 'temps' },
      { cle: 'demineur-moyen', titre: 'MOYEN', ordre: 'petit', format: 'temps' },
      { cle: 'demineur-difficile', titre: 'DIFFICILE', ordre: 'petit', format: 'temps' }
    ],
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter
  });
})();
