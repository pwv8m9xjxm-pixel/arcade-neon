/* ==========================================================================
   ecrans.js — Les fenêtres communes à tous les jeux
   --------------------------------------------------------------------------
   - l'écran de départ (règles, contrôles, record, bouton JOUER)
   - l'écran de pause
   - l'écran de fin (score, saisie du pseudo si record, REJOUER)
   - le tableau des scores (aussi utilisé par la page Classements)

   On fabrique le HTML avec document.createElement() plutôt qu'en collant
   du texte HTML. Pourquoi ? Les pseudos sont tapés par les joueurs : avec
   textContent, même si quelqu'un tape « <script> », ça s'affiche comme du
   simple texte, sans danger.
   ========================================================================== */

Arcade.ecrans = (function () {
  const overlay = document.getElementById('overlay');
  const contenu = document.getElementById('overlay-contenu');

  /* --- Petits raccourcis pour créer des éléments --- */

  // el('p', 'ma-classe', 'Bonjour') → <p class="ma-classe">Bonjour</p>
  function el(balise, classe, texte) {
    const element = document.createElement(balise);
    if (classe) element.className = classe;
    if (texte !== undefined && texte !== null) element.textContent = texte;
    return element;
  }

  function bouton(texte, action, classe) {
    const b = el('button', 'bouton ' + (classe || ''), texte);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }

  // Un <div> qui contient plusieurs éléments (les « null » sont ignorés)
  function groupe(classe, enfants) {
    const div = el('div', classe);
    enfants.forEach(function (enfant) {
      if (enfant) div.appendChild(enfant);
    });
    return div;
  }

  /* --- Afficher / cacher la fenêtre --- */
  function montrer(elements) {
    contenu.innerHTML = '';
    elements.forEach(function (element) {
      if (element) contenu.appendChild(element);
    });
    overlay.classList.remove('cache');
    overlay.scrollTop = 0;
  }

  function cacher() {
    overlay.classList.add('cache');
    contenu.innerHTML = '';
  }

  /* --- Morceaux réutilisés --- */

  // La liste « touche → action » (la pause est ajoutée automatiquement)
  function blocControles(jeu) {
    const liste = el('div', 'liste-controles');
    const lignes = jeu.controles.concat([['P / Échap / ❚❚', 'Pause']]);
    lignes.forEach(function (ligne) {
      liste.appendChild(el('span', 'touche', ligne[0]));
      liste.appendChild(el('span', 'action', ligne[1]));
    });
    return groupe('bloc-controles', [el('h3', null, 'COMMENT JOUER'), liste]);
  }

  // Le(s) record(s) du jeu
  function blocRecords(jeu) {
    const defs = Arcade.classementsDuJeu(jeu);
    const bloc = el('div', 'bloc-records');
    defs.forEach(function (def) {
      const m = Arcade.scores.meilleur(def.cle);
      const prefixe = defs.length > 1 ? 'RECORD ' + def.titre + ' : ' : 'RECORD : ';
      const texte = m ? Arcade.scores.formater(m.valeur, def.format) + ' (' + m.pseudo + ')' : '---';
      bloc.appendChild(el('p', null, prefixe + texte));
    });
    return bloc;
  }

  // Tableau des 10 meilleurs. rangSurligne = la ligne à faire clignoter.
  function tableauScores(def, rangSurligne) {
    const scores = Arcade.scores.liste(def.cle);
    const ol = el('ol', 'tableau-scores');
    for (let i = 0; i < 10; i++) {
      const entree = scores[i];
      const li = el('li', i < 3 ? 'podium-' + (i + 1) : null);
      if (rangSurligne === i + 1) li.classList.add('surligne');
      li.appendChild(el('span', 'rang', String(i + 1).padStart(2, '0')));
      li.appendChild(el('span', 'pseudo', entree ? entree.pseudo : '---'));
      li.appendChild(el('span', 'valeur', entree ? Arcade.scores.formater(entree.valeur, def.format) : '---'));
      ol.appendChild(li);
    }
    return ol;
  }

  /* --- 1. Écran de départ ---
     o = { option, jouer(option), menu() } */
  function depart(jeu, o) {
    let choix = o.option;
    let blocOptions = null;

    // Certains jeux proposent un choix avant de jouer (le niveau du Démineur)
    if (jeu.options) {
      const ids = jeu.options.choix.map(function (c) { return c.id; });
      if (ids.indexOf(choix) === -1) choix = ids[0];
      const rangee = el('div', 'choix-options');
      jeu.options.choix.forEach(function (opt) {
        const b = bouton(opt.texte, function () {
          choix = opt.id;
          rangee.querySelectorAll('button').forEach(function (autre) {
            autre.classList.toggle('choisi', autre === b);
          });
        }, 'option');
        if (opt.id === choix) b.classList.add('choisi');
        rangee.appendChild(b);
      });
      blocOptions = groupe('bloc-options', [el('h3', null, jeu.options.titre), rangee]);
    }

    const boutonJouer = bouton('▶ JOUER', function () { o.jouer(choix); }, 'gros');
    montrer([
      el('h2', 'titre-overlay', jeu.nom),
      el('p', 'description', jeu.description),
      blocControles(jeu),
      blocOptions,
      blocRecords(jeu),
      groupe('boutons', [boutonJouer, bouton('MENU', o.menu, 'secondaire')])
    ]);
    boutonJouer.focus(); // Entrée ou Espace lance directement la partie
  }

  /* --- 2. Écran de pause ---
     o = { reprendre(), recommencer(), menu() } */
  function pause(jeu, o) {
    const boutonReprendre = bouton('▶ REPRENDRE', o.reprendre, 'gros');
    montrer([
      el('h2', 'titre-overlay', 'PAUSE'),
      groupe('boutons', [
        boutonReprendre,
        bouton('RECOMMENCER', o.recommencer, 'secondaire'),
        bouton('MENU', o.menu, 'secondaire')
      ]),
      blocControles(jeu)
    ]);
    boutonReprendre.focus();
  }

  /* --- 3. Écran de fin ---
     o = {
       infos : ce que le jeu a envoyé { valeur, cle, titre, details }
               (valeur = null → pas de classement, ex. : perdu au Démineur)
       def   : le classement concerné { cle, titre, ordre, format }
       rejouer(), menu()
     } */
  function fin(o) {
    const infos = o.infos;
    const def = o.def;
    const aUneValeur = typeof infos.valeur === 'number';
    const elements = [el('h2', 'titre-overlay titre-fin', infos.titre || 'GAME OVER')];

    if (infos.details) elements.push(el('p', 'details', infos.details));
    if (aUneValeur) {
      const etiquette = def.format === 'temps' ? 'TEMPS : ' : 'SCORE : ';
      elements.push(el('p', 'score-final', etiquette + Arcade.scores.formater(infos.valeur, def.format)));
    }

    const bas = el('div', 'fin-bas');
    elements.push(bas);

    const rang = aUneValeur ? Arcade.scores.rangPotentiel(def.cle, infos.valeur, def.ordre) : 0;
    if (rang > 0) afficherSaisie();
    else afficherBoutons(0);
    montrer(elements);

    // a) Le score entre dans le top 10 : on demande le pseudo
    function afficherSaisie() {
      const form = el('form', 'saisie-pseudo');
      form.appendChild(el('p', 'nouveau-record', '★ TOP 10 : N°' + rang + ' ★'));
      const label = el('label', null, 'TON PSEUDO :');
      label.htmlFor = 'champ-pseudo';
      const champ = el('input');
      champ.id = 'champ-pseudo';
      champ.maxLength = 10;
      champ.autocomplete = 'off';
      champ.spellcheck = false;
      champ.setAttribute('autocapitalize', 'characters');
      champ.value = Arcade.scores.dernierPseudo(); // on pré-remplit avec le dernier pseudo
      const ok = el('button', 'bouton gros', 'OK');
      ok.type = 'submit';
      form.appendChild(label);
      form.appendChild(champ);
      form.appendChild(ok);

      // « submit » = clic sur OK ou touche Entrée dans le champ
      form.addEventListener('submit', function (e) {
        e.preventDefault(); // sinon le navigateur rechargerait la page !
        const pseudo = Arcade.scores.nettoyerPseudo(champ.value);
        Arcade.scores.dernierPseudo(pseudo);
        const rangFinal = Arcade.scores.ajouter(def.cle, pseudo, infos.valeur, def.ordre);
        champ.blur();
        afficherBoutons(rangFinal);
      });

      bas.innerHTML = '';
      bas.appendChild(form);
      setTimeout(function () {
        champ.focus();
        champ.select();
      }, 60);
    }

    // b) Le classement (si on vient d'y entrer) ou le record, puis REJOUER / MENU
    function afficherBoutons(rangAjoute) {
      bas.innerHTML = '';
      if (rangAjoute) {
        bas.appendChild(tableauScores(def, rangAjoute));
      } else {
        const m = Arcade.scores.meilleur(def.cle);
        const texte = m ? Arcade.scores.formater(m.valeur, def.format) + ' (' + m.pseudo + ')' : '---';
        bas.appendChild(el('p', 'record-actuel', 'RECORD : ' + texte));
      }
      const boutonRejouer = bouton('↻ REJOUER', o.rejouer, 'gros');
      const boutonMenu = bouton('MENU', o.menu, 'secondaire');
      // Petit délai avant de pouvoir cliquer : si on tapotait encore
      // l'écran au moment de perdre, on ne relance pas une partie par erreur.
      boutonRejouer.disabled = true;
      boutonMenu.disabled = true;
      setTimeout(function () {
        boutonRejouer.disabled = false;
        boutonMenu.disabled = false;
        boutonRejouer.focus();
      }, 600);
      bas.appendChild(groupe('boutons', [boutonRejouer, boutonMenu]));
    }
  }

  return {
    depart: depart,
    pause: pause,
    fin: fin,
    cacher: cacher,
    tableauScores: tableauScores
  };
})();
