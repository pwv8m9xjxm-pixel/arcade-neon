/* ==========================================================================
   main.js — Le chef d'orchestre (chargé EN DERNIER)
   --------------------------------------------------------------------------
   Il :
     1. construit le menu à partir de la liste des jeux,
     2. passe d'un écran à l'autre (menu ↔ jeu ↔ classements),
     3. gère le déroulement d'une partie : départ → jeu → pause → fin,
     4. transmet le clavier et les gestes tactiles au jeu en cours,
     5. affiche la page Classements.

   ---- Le « contrat » que chaque jeu respecte ----
   Chaque fichier de js/games/ s'inscrit avec un objet qui contient :
     id, nom, couleur, description, icone, controles   (pour le menu)
     demarrer(zone, api, option)  → crée le jeu dans « zone » et le lance
     pause(), reprendre()         → met en pause / relance
     arreter()                    → arrête tout (boucles, minuteurs)
   et, si besoin :
     touche(code, evenement)  → une touche du clavier vient d'être appuyée
     balayage(direction)      → balayage tactile 'haut' / 'bas' / 'gauche' / 'droite'
     tape(evenement)          → toucher court sur la zone de jeu
     appui(evenement)         → le doigt / la souris se pose sur la zone de jeu
     balayageContinu: true    → plusieurs balayages possibles sans lever le doigt
     options, classements     → voir le Démineur

   En échange, le jeu reçoit un objet « api » pour communiquer avec le site :
     api.creerCanvas(largeur, hauteur) → { canvas, ctx }
     api.ajuster(element, largeur, hauteur)
     api.hud(texteGauche, texteDroite)   → la ligne d'infos en haut
     api.boutonTactile(texte, codeTouche)
     api.zoneTactile                     → pour y ajouter ses propres boutons
     api.fin({ valeur, cle, titre, details }) → la partie est terminée
   ========================================================================== */

(function () {
  // Raccourci : $('id') au lieu de document.getElementById('id')
  const $ = function (id) { return document.getElementById(id); };

  const ecrans = {
    menu: $('ecran-menu'),
    classements: $('ecran-classements'),
    jeu: $('ecran-jeu')
  };
  const zone = $('zone-jeu');
  const zoneTactile = $('zone-tactile');

  /* L'« état » dit où on en est. Il ne peut valoir que :
     'menu' | 'classements' | 'depart' | 'jeu' | 'pause' | 'fin' */
  let etat = 'menu';
  let jeuCourant = null;
  const optionsChoisies = {}; // dernière option choisie pour chaque jeu
  let elementAjuste = null;   // l'élément à redimensionner quand la fenêtre change

  // Touches dont on bloque l'effet normal pendant le jeu (faire défiler la page)
  const TOUCHES_BLOQUEES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];


  /* ================== Navigation entre les écrans ================== */
  function afficherEcran(nom) {
    Object.keys(ecrans).forEach(function (n) {
      ecrans[n].classList.toggle('actif', n === nom);
    });
    window.scrollTo(0, 0);
  }


  /* ================== 1. Le menu ================== */
  function construireMenu() {
    const liste = $('liste-jeux');
    Arcade.jeux.forEach(function (jeu, i) {
      const carte = document.createElement('button');
      carte.type = 'button';
      carte.className = 'carte-jeu';
      carte.style.setProperty('--couleur', jeu.couleur);

      const numero = document.createElement('span');
      numero.className = 'numero';
      numero.textContent = 'JEU 0' + (i + 1);

      // L'icône est un petit sprite en pixels dessiné dans un canvas
      const icone = Arcade.sprite(jeu.icone, jeu.couleur, 6, 6);
      icone.className = 'icone';

      const nom = document.createElement('span');
      nom.className = 'nom';
      nom.textContent = jeu.nom;

      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = jeu.resume;

      const record = document.createElement('span');
      record.className = 'record';
      record.dataset.jeu = jeu.id; // pour retrouver le jeu plus tard

      carte.append(numero, icone, nom, desc, record);
      carte.addEventListener('click', function () { ouvrirJeu(jeu.id); });
      liste.appendChild(carte);
    });
  }

  // Met à jour la ligne « record » de chaque carte
  function majRecordsMenu() {
    document.querySelectorAll('.carte-jeu .record').forEach(function (span) {
      const jeu = Arcade.trouverJeu(span.dataset.jeu);
      const def = Arcade.classementsDuJeu(jeu)[0];
      const m = Arcade.scores.meilleur(def.cle);
      const prefixe = jeu.classements ? def.titre + ' ' : '';
      span.textContent = prefixe + '★ ' + (m ? Arcade.scores.formater(m.valeur, def.format) : '---');
    });
  }

  function retourMenu() {
    if (jeuCourant) jeuCourant.arreter();
    Arcade.ecrans.cacher();
    viderZone();
    Arcade.controles.toutRelacher();
    jeuCourant = null;
    etat = 'menu';
    majRecordsMenu();
    afficherEcran('menu');
  }


  /* ================== 2. Une partie ================== */

  // L'objet « api » donné au jeu pour qu'il communique avec le site
  function creerApi() {
    const api = {
      zoneTactile: zoneTactile,

      ajuster: function (element, largeur, hauteur) {
        elementAjuste = { element: element, largeur: largeur, hauteur: hauteur };
        Arcade.ajuster(element, largeur, hauteur, zone);
      },

      creerCanvas: function (largeur, hauteur) {
        const canvas = document.createElement('canvas');
        canvas.width = largeur;   // taille « logique » (celle où le jeu dessine)
        canvas.height = hauteur;
        zone.appendChild(canvas);
        api.ajuster(canvas, largeur, hauteur); // taille à l'écran
        return { canvas: canvas, ctx: canvas.getContext('2d') };
      },

      hud: function (gauche, droite) {
        $('hud-gauche').textContent = gauche || '';
        $('hud-droite').textContent = droite || '';
      },

      boutonTactile: function (texte, code) {
        const b = Arcade.controles.creerBoutonTactile(texte, code);
        zoneTactile.appendChild(b);
        return b;
      },

      fin: function (infos) {
        terminerPartie(infos || {});
      }
    };
    return api;
  }

  function viderZone() {
    zone.innerHTML = '';
    zoneTactile.innerHTML = '';
    elementAjuste = null;
    $('hud-gauche').textContent = '';
    $('hud-droite').textContent = '';
  }

  // Quand la fenêtre change de taille (ou qu'on tourne le téléphone)
  function redimensionner() {
    if (elementAjuste) {
      Arcade.ajuster(elementAjuste.element, elementAjuste.largeur, elementAjuste.hauteur, zone);
    }
  }
  window.addEventListener('resize', redimensionner);

  // Clic sur une carte du menu : on affiche l'écran de départ du jeu
  function ouvrirJeu(id) {
    jeuCourant = Arcade.trouverJeu(id);
    if (!jeuCourant) return;
    ecrans.jeu.style.setProperty('--couleur-jeu', jeuCourant.couleur);
    $('titre-jeu').textContent = jeuCourant.nom;
    viderZone();
    afficherEcran('jeu');
    etat = 'depart';
    Arcade.ecrans.depart(jeuCourant, {
      option: optionsChoisies[jeuCourant.id],
      jouer: function (option) {
        optionsChoisies[jeuCourant.id] = option;
        lancerPartie();
      },
      menu: retourMenu
    });
  }

  // (Re)commence une partie
  function lancerPartie() {
    if (!jeuCourant) return;
    jeuCourant.arreter();            // au cas où une partie tournait encore
    Arcade.ecrans.cacher();
    Arcade.controles.toutRelacher();
    viderZone();
    // On retire le focus du bouton cliqué : sinon la barre Espace le « recliquerait »
    if (document.activeElement) document.activeElement.blur();
    etat = 'jeu';
    jeuCourant.demarrer(zone, creerApi(), optionsChoisies[jeuCourant.id]);
    // Les boutons tactiles ont pu prendre de la place : on réajuste à l'image suivante
    requestAnimationFrame(redimensionner);
  }

  function mettreEnPause() {
    if (etat !== 'jeu') return;
    etat = 'pause';
    jeuCourant.pause();
    Arcade.controles.toutRelacher();
    Arcade.ecrans.pause(jeuCourant, {
      reprendre: reprendre,
      recommencer: lancerPartie,
      menu: retourMenu
    });
  }

  function reprendre() {
    if (etat !== 'pause') return;
    Arcade.ecrans.cacher();
    if (document.activeElement) document.activeElement.blur();
    etat = 'jeu';
    jeuCourant.reprendre();
  }

  // Appelée par le jeu via api.fin(...)
  function terminerPartie(infos) {
    if (etat !== 'jeu' && etat !== 'pause') return; // sécurité : une seule fin par partie
    etat = 'fin';
    jeuCourant.arreter();
    Arcade.controles.toutRelacher();
    const cle = infos.cle || jeuCourant.id;
    const def = Arcade.trouverClassement(cle) || Arcade.classementsDuJeu(jeuCourant)[0];
    Arcade.ecrans.fin({
      infos: infos,
      def: def,
      rejouer: lancerPartie,
      menu: retourMenu
    });
  }

  // Si on change d'onglet ou qu'on verrouille le téléphone : pause automatique
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) mettreEnPause();
  });

  // Boutons de la barre du haut
  $('bouton-retour').addEventListener('click', retourMenu);
  $('bouton-pause').addEventListener('click', function () {
    this.blur();
    if (etat === 'jeu') mettreEnPause();
    else if (etat === 'pause') reprendre();
  });


  /* ================== 3. Clavier et gestes → jeu en cours ================== */
  Arcade.controles.brancher({
    toucheAppuyee: function (e) {
      const pauseDemandee = e.code === 'KeyP' || e.code === 'Escape';

      if (pauseDemandee && etat === 'jeu') { e.preventDefault(); mettreEnPause(); return; }
      if (pauseDemandee && etat === 'pause') { e.preventDefault(); reprendre(); return; }
      if (e.code === 'Escape' && (etat === 'depart' || etat === 'classements')) { retourMenu(); return; }

      if (etat !== 'jeu') return;
      if (TOUCHES_BLOQUEES.indexOf(e.code) !== -1) e.preventDefault();
      if (jeuCourant.touche) jeuCourant.touche(e.code, e);
    },
    balayage: function (direction) {
      if (etat === 'jeu' && jeuCourant.balayage) jeuCourant.balayage(direction);
    },
    tape: function (e) {
      if (etat === 'jeu' && jeuCourant.tape) jeuCourant.tape(e);
    },
    appui: function (e) {
      if (etat === 'jeu' && jeuCourant.appui) jeuCourant.appui(e);
    },
    balayageContinu: function () {
      return !!(jeuCourant && jeuCourant.balayageContinu);
    }
  });
  Arcade.controles.activerGestes(zone);


  /* ================== 4. Page Classements ================== */
  let ongletJeu = null;  // id du jeu affiché
  let ongletCle = null;  // classement affiché (utile pour les niveaux du Démineur)
  let defAffiche = null;

  function ouvrirClassements() {
    if (!ongletJeu) ongletJeu = Arcade.jeux[0].id;
    etat = 'classements';
    afficherEcran('classements');
    dessinerClassements();
  }

  function creerOnglet(texte, couleur, actif, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'onglet' + (actif ? ' actif' : '');
    b.style.setProperty('--couleur', couleur);
    b.textContent = texte;
    b.addEventListener('click', action);
    return b;
  }

  function dessinerClassements() {
    const jeu = Arcade.trouverJeu(ongletJeu);
    const defs = Arcade.classementsDuJeu(jeu);
    if (!defs.some(function (d) { return d.cle === ongletCle; })) ongletCle = defs[0].cle;
    defAffiche = defs.find(function (d) { return d.cle === ongletCle; });

    // Un onglet par jeu
    const onglets = $('onglets-jeux');
    onglets.innerHTML = '';
    Arcade.jeux.forEach(function (j) {
      onglets.appendChild(creerOnglet(j.nom, j.couleur, j.id === ongletJeu, function () {
        ongletJeu = j.id;
        dessinerClassements();
      }));
    });

    // Des sous-onglets si le jeu a plusieurs classements
    const sousOnglets = $('onglets-niveaux');
    sousOnglets.innerHTML = '';
    if (defs.length > 1) {
      defs.forEach(function (d) {
        sousOnglets.appendChild(creerOnglet(d.titre, jeu.couleur, d.cle === ongletCle, function () {
          ongletCle = d.cle;
          dessinerClassements();
        }));
      });
    }

    ecrans.classements.style.setProperty('--couleur-jeu', jeu.couleur);
    let titre = jeu.nom;
    if (defs.length > 1) titre += ' - ' + defAffiche.titre;
    if (defAffiche.format === 'temps') titre += ' (MEILLEUR TEMPS)';
    $('titre-classement').textContent = titre;

    const conteneur = $('conteneur-tableau');
    conteneur.innerHTML = '';
    conteneur.appendChild(Arcade.ecrans.tableauScores(defAffiche));
  }

  $('bouton-classements').addEventListener('click', ouvrirClassements);
  $('classements-retour').addEventListener('click', retourMenu);

  // Réinitialisation, toujours avec une confirmation
  $('bouton-effacer').addEventListener('click', function () {
    const nom = $('titre-classement').textContent;
    if (confirm('Effacer le classement « ' + nom + ' » ?\nC\'est définitif.')) {
      Arcade.scores.effacer(defAffiche.cle);
      dessinerClassements();
    }
  });
  $('bouton-effacer-tout').addEventListener('click', function () {
    if (confirm('Effacer TOUS les classements de TOUS les jeux ?\nC\'est définitif.')) {
      Arcade.scores.effacerTout();
      dessinerClassements();
    }
  });


  /* ================== 5. Démarrage du site ================== */
  construireMenu();
  majRecordsMenu();
  if (!Arcade.scores.stockageDisponible()) {
    $('alerte-stockage').hidden = false;
  }
})();
