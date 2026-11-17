/* ==========================================================================
   jeu2048.js — 2048
   --------------------------------------------------------------------------
   Règle : on fait glisser toutes les tuiles dans une direction. Deux tuiles
   de même valeur qui se rencontrent fusionnent (2+2=4, 4+4=8…) et on gagne
   des points. Après chaque coup, une nouvelle tuile (2 ou 4) apparaît.
   La partie se termine quand plus aucun mouvement n'est possible.

   Ce jeu n'utilise PAS de canvas : le plateau est une grille de <div>.
   C'est plus simple pour un jeu « tour par tour » qui ne bouge que
   quand le joueur joue (pas besoin de boucle à 60 images par seconde).
   ========================================================================== */

(function () {
  // (function () { … })() est une « fonction auto-appelée » : tout ce qui
  // est déclaré ici reste privé à ce fichier → aucun conflit avec les autres jeux.

  const TAILLE = 4; // plateau de 4 × 4

  let api = null;
  let plateau = null;   // le <div> du plateau
  let grille = [];      // grille[ligne][colonne] = { valeur, nouvelle, fusion } ou null
  let score = 0;
  let enPause = false;
  let finie = false;
  let a2048 = false;    // a-t-on déjà atteint 2048 ?
  let minuteurFin = null;

  /* ---------- Démarrage ---------- */
  function demarrer(zone, apiPartie) {
    api = apiPartie;
    score = 0;
    enPause = false;
    finie = false;
    a2048 = false;

    // Une grille 4×4 remplie de « null » (= case vide)
    grille = [];
    for (let l = 0; l < TAILLE; l++) {
      grille.push(new Array(TAILLE).fill(null));
    }

    plateau = document.createElement('div');
    plateau.className = 'plateau-2048';
    zone.appendChild(plateau);
    api.ajuster(plateau, 1, 1); // plateau carré (rapport 1 pour 1)

    ajouterTuile();
    ajouterTuile();
    dessiner();
  }

  /* ---------- Tuiles ---------- */
  function casesVides() {
    const vides = [];
    for (let l = 0; l < TAILLE; l++) {
      for (let c = 0; c < TAILLE; c++) {
        if (!grille[l][c]) vides.push([l, c]);
      }
    }
    return vides;
  }

  // Ajoute un 2 (90 % du temps) ou un 4 (10 %) sur une case vide au hasard
  function ajouterTuile() {
    const vides = casesVides();
    if (vides.length === 0) return;
    const choix = vides[Math.floor(Math.random() * vides.length)];
    grille[choix[0]][choix[1]] = {
      valeur: Math.random() < 0.9 ? 2 : 4,
      nouvelle: true,
      fusion: false
    };
  }

  /* ---------- Le cœur du jeu : déplacer les tuiles ----------
     Idée : on traite le plateau ligne par ligne (ou colonne par colonne),
     toujours « dans le sens du mouvement ». Pour chaque ligne :
       1. on récupère les tuiles (sans les trous),
       2. on fusionne les paires identiques qui se suivent,
       3. on les remet en place, collées du côté du mouvement. */
  function deplacer(direction) {
    if (enPause || finie) return;

    // On efface les marques d'animation du coup précédent
    for (const ligne of grille) {
      for (const tuile of ligne) {
        if (tuile) { tuile.nouvelle = false; tuile.fusion = false; }
      }
    }

    let aBouge = false;

    for (let i = 0; i < TAILLE; i++) {
      // Les 4 positions de cette ligne/colonne, de la plus « avancée » à la moins avancée
      const positions = [];
      for (let j = 0; j < TAILLE; j++) {
        if (direction === 'gauche') positions.push([i, j]);
        else if (direction === 'droite') positions.push([i, TAILLE - 1 - j]);
        else if (direction === 'haut') positions.push([j, i]);
        else positions.push([TAILLE - 1 - j, i]); // bas
      }

      // 1. Les tuiles présentes, sans les trous
      const tuiles = positions
        .map(function (p) { return grille[p[0]][p[1]]; })
        .filter(function (t) { return t !== null; });

      // 2. Fusion des paires
      const resultat = [];
      for (let k = 0; k < tuiles.length; k++) {
        const suivante = tuiles[k + 1];
        if (suivante && suivante.valeur === tuiles[k].valeur) {
          const nouvelleValeur = tuiles[k].valeur * 2;
          resultat.push({ valeur: nouvelleValeur, nouvelle: false, fusion: true });
          score += nouvelleValeur;
          if (nouvelleValeur === 2048) a2048 = true;
          k++; // on saute la tuile qui vient d'être absorbée
        } else {
          resultat.push(tuiles[k]);
        }
      }

      // 3. On replace (et on note si quelque chose a changé)
      positions.forEach(function (p, k) {
        const tuile = resultat[k] || null;
        if (grille[p[0]][p[1]] !== tuile) aBouge = true;
        grille[p[0]][p[1]] = tuile;
      });
    }

    if (!aBouge) return; // coup inutile : pas de nouvelle tuile

    ajouterTuile();
    dessiner();

    if (!mouvementPossible()) {
      finie = true;
      // Petit délai pour laisser voir le plateau final
      minuteurFin = setTimeout(function () {
        api.fin({ valeur: score, titre: 'PLUS DE COUPS !', details: 'Meilleure tuile : ' + tuileMax() });
      }, 700);
    }
  }

  // Reste-t-il au moins un coup jouable ?
  function mouvementPossible() {
    for (let l = 0; l < TAILLE; l++) {
      for (let c = 0; c < TAILLE; c++) {
        const t = grille[l][c];
        if (!t) return true;                                                   // une case vide
        if (c + 1 < TAILLE && grille[l][c + 1] && grille[l][c + 1].valeur === t.valeur) return true; // voisin de droite
        if (l + 1 < TAILLE && grille[l + 1][c] && grille[l + 1][c].valeur === t.valeur) return true; // voisin du dessous
      }
    }
    return false;
  }

  function tuileMax() {
    let max = 0;
    for (const ligne of grille) {
      for (const t of ligne) {
        if (t && t.valeur > max) max = t.valeur;
      }
    }
    return max;
  }

  /* ---------- Affichage ----------
     On reconstruit les 16 cases à chaque coup : c'est très rapide. */
  function dessiner() {
    plateau.innerHTML = '';
    for (let l = 0; l < TAILLE; l++) {
      for (let c = 0; c < TAILLE; c++) {
        const caseEl = document.createElement('div');
        caseEl.className = 'case-2048';
        const t = grille[l][c];
        if (t) {
          const tuile = document.createElement('div');
          const classeValeur = t.valeur <= 2048 ? 'v' + t.valeur : 'v-grand';
          tuile.className = 'tuile ' + classeValeur + ' chiffres-' + String(t.valeur).length;
          if (t.nouvelle) tuile.classList.add('apparition');
          if (t.fusion) tuile.classList.add('fusion');
          tuile.textContent = t.valeur;
          caseEl.appendChild(tuile);
        }
        plateau.appendChild(caseEl);
      }
    }
    api.hud('SCORE ' + score, a2048 ? '★ 2048 ! ★' : 'MAX ' + tuileMax());
  }

  /* ---------- Contrôles ---------- */
  function touche(code) {
    const dir = Arcade.controles.direction(code);
    if (dir) deplacer(dir);
  }

  function balayage(direction) {
    deplacer(direction);
  }

  /* ---------- Pause / arrêt ---------- */
  function pause() { enPause = true; }
  function reprendre() { enPause = false; }
  function arreter() {
    finie = true;
    clearTimeout(minuteurFin);
  }

  /* ---------- Inscription dans l'arcade ---------- */
  Arcade.enregistrerJeu({
    id: '2048',
    nom: '2048',
    couleur: Arcade.couleurs.jaune,
    resume: 'Fusionne les tuiles',
    description: 'Fais glisser les tuiles. Deux tuiles identiques qui se touchent fusionnent. Vise la tuile 2048 !',
    icone: [
      '###..###',
      '#.#..#.#',
      '###..###',
      '........',
      '........',
      '###..###',
      '#.#..#.#',
      '###..###'
    ],
    controles: [
      ['FLÈCHES / ZQSD', 'Faire glisser les tuiles'],
      ['Balayage', 'Faire glisser (mobile)']
    ],
    demarrer: demarrer,
    pause: pause,
    reprendre: reprendre,
    arreter: arreter,
    touche: touche,
    balayage: balayage
  });
})();
