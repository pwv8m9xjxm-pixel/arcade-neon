/* ==========================================================================
   controles.js — Clavier, balayages tactiles et boutons à l'écran
   --------------------------------------------------------------------------
   Ce fichier « écoute » le clavier et les doigts, puis transmet ce qu'il
   a compris à un « récepteur » (c'est main.js, qui le fait suivre au jeu).

   ASTUCE ZQSD : on utilise « event.code », qui désigne l'EMPLACEMENT de la
   touche sur le clavier (comme sur un clavier américain QWERTY), et non la
   lettre écrite dessus. Sur un clavier français AZERTY, la touche Z a le
   code « KeyW », Q a le code « KeyA »… Résultat : ZQSD marche en AZERTY
   ET WASD marche en QWERTY, sans rien faire de spécial !
   ========================================================================== */

Arcade.controles = (function () {
  // Quelle direction pour quelle touche ?
  const DIRECTIONS = {
    ArrowUp: 'haut', KeyW: 'haut',       // ↑ ou Z (AZERTY)
    ArrowDown: 'bas', KeyS: 'bas',        // ↓ ou S
    ArrowLeft: 'gauche', KeyA: 'gauche',  // ← ou Q (AZERTY)
    ArrowRight: 'droite', KeyD: 'droite'  // → ou D
  };

  // Distance (en pixels) que le doigt doit parcourir pour compter comme un balayage
  const SEUIL_BALAYAGE = 30;

  // Touches actuellement enfoncées (un « Set » = une liste sans doublons)
  const enfoncees = new Set();

  // Celui à qui on transmet les événements (défini par main.js)
  let recepteur = null;

  function brancher(nouveauRecepteur) {
    recepteur = nouveauRecepteur;
  }

  /* --- Petites questions que les jeux peuvent poser --- */

  // 'ArrowLeft' → 'gauche' ; 'KeyP' → null
  function direction(code) {
    return DIRECTIONS[code] || null;
  }

  // La touche est-elle enfoncée en ce moment ?
  function estEnfoncee(code) {
    return enfoncees.has(code);
  }

  // Une touche de cette direction est-elle enfoncée ? (flèche OU ZQSD)
  function directionEnfoncee(dir) {
    for (const code of enfoncees) {
      if (DIRECTIONS[code] === dir) return true;
    }
    return false;
  }

  function toutRelacher() {
    enfoncees.clear();
    document.querySelectorAll('.bouton-tactile.actif').forEach(function (b) {
      b.classList.remove('actif');
    });
  }

  /* --- Clavier --- */
  function estChampTexte(cible) {
    return cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA');
  }

  document.addEventListener('keydown', function (e) {
    // Quand on tape son pseudo, les touches ne doivent pas piloter le jeu !
    if (estChampTexte(e.target)) return;
    enfoncees.add(e.code);
    if (recepteur) recepteur.toucheAppuyee(e);
  });

  document.addEventListener('keyup', function (e) {
    enfoncees.delete(e.code);
  });

  // Si la fenêtre perd le focus, on oublie les touches (sinon elles restent « coincées »)
  window.addEventListener('blur', toutRelacher);

  /* --- Gestes tactiles (et souris) sur la zone de jeu ---
     On utilise les « pointer events » : ils marchent pareil pour un doigt,
     une souris ou un stylet.
     - appui   : le doigt (ou le clic) se pose        → Flappy
     - balayage: le doigt glisse d'au moins 30 px     → 2048, Snake, Blocs
     - tape    : touche courte sans glisser           → Blocs, Casse-briques */
  function activerGestes(element) {
    let depart = null;

    element.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return; // clic gauche seulement
      depart = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        temps: performance.now(),
        aBalaye: false,
        bloque: false
      };
      if (recepteur) recepteur.appui(e);
    });

    element.addEventListener('pointermove', function (e) {
      if (!depart || e.pointerId !== depart.id || depart.bloque) return;
      const dx = e.clientX - depart.x;
      const dy = e.clientY - depart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SEUIL_BALAYAGE) return;

      // On garde l'axe où le doigt a le plus bougé
      let dir;
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'droite' : 'gauche';
      else dir = dy > 0 ? 'bas' : 'haut';

      depart.aBalaye = true;
      if (recepteur) recepteur.balayage(dir);

      if (recepteur && recepteur.balayageContinu()) {
        // Mode « continu » (Snake, Blocs) : on repart de la position actuelle,
        // donc on peut enchaîner plusieurs balayages sans lever le doigt.
        depart.x = e.clientX;
        depart.y = e.clientY;
      } else {
        // Mode simple (2048) : un seul balayage par geste.
        depart.bloque = true;
      }
    });

    function finGeste(e) {
      if (!depart || e.pointerId !== depart.id) return;
      const duree = performance.now() - depart.temps;
      if (e.type === 'pointerup' && !depart.aBalaye && duree < 350 && recepteur) {
        recepteur.tape(e);
      }
      depart = null;
    }
    element.addEventListener('pointerup', finGeste);
    element.addEventListener('pointercancel', finGeste);
  }

  /* --- Boutons tactiles à l'écran ---
     Un bouton qui fait « comme si » on appuyait sur une touche du clavier.
     Exemple : creerBoutonTactile('◀', 'ArrowLeft') → tant que le doigt est
     posé dessus, le jeu croit que la flèche gauche est enfoncée. */
  function creerBoutonTactile(texte, code) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bouton-tactile';
    bouton.textContent = texte;

    bouton.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      // « capturer » le doigt : on reçoit son relâchement même s'il a glissé hors du bouton
      try { bouton.setPointerCapture(e.pointerId); } catch (erreur) { /* rien */ }
      bouton.classList.add('actif');
      enfoncees.add(code);
      if (recepteur) {
        // Un faux événement clavier, avec juste ce dont les jeux ont besoin
        recepteur.toucheAppuyee({ code: code, repeat: false, virtuel: true, preventDefault: function () {} });
      }
    });

    function relacher() {
      bouton.classList.remove('actif');
      enfoncees.delete(code);
    }
    bouton.addEventListener('pointerup', relacher);
    bouton.addEventListener('pointercancel', relacher);
    bouton.addEventListener('lostpointercapture', relacher);
    // Empêche le menu « copier/coller » d'apparaître sur un appui long
    bouton.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return bouton;
  }

  return {
    brancher: brancher,
    direction: direction,
    estEnfoncee: estEnfoncee,
    directionEnfoncee: directionEnfoncee,
    toutRelacher: toutRelacher,
    activerGestes: activerGestes,
    creerBoutonTactile: creerBoutonTactile
  };
})();
