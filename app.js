/* ════════════════════════════════════════════════════════════════════
   DDT 90 — AIDE A LA DECISION — app.js
   Logique applicative : carte, placement projet, couches thématiques,
   analyse des enjeux, génération des fiches, modale.

   Dépend de : enjeux-db.js (GEOJSON_TB, THEMES, TYPES, TAILLES, ENJEUX)
   ════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════
   COUCHES THEMATIQUES — ATLAS DDT 90 2025-2026
   Structure calquee exactement sur les chapitres de l'Atlas :
     1. Organisation du territoire   (C1–C8)
     2. Population, economie, services (C9–C15)
     3. Nouvelles energies & climat  (C16–C26)
     4. Agriculture                  (C27–C40)
     5. Eau                          (C41–C49)
     6. Biodiversite et foret        (C50–C58)
     7. Risques naturels             (C56–C64)
     8. Urbanisme & amenagement      (C65–C71)
     9. Habitat et logement          (C72–C81)
    10. Mobilites & securite routiere (C82–C87)
    11. Autres thematiques           (C88–C91)
   Les coordonnees sont des approximations fiables pour le 90.
   En production : remplacer par les flux WFS de l'IGN / DDT 90.
   ════════════════════════════════════════════════════════════════════ */

var COUCHE_STYLES = {
  /* Couleur, fill, label affiches dans la legende et le panneau */
  organisation:  { color: '#1d4ed8', fill: '#60a5fa', label: 'Organisation du territoire',    swatch: '#3b82f6' },
  population:    { color: '#7c3aed', fill: '#c084fc', label: 'Population & Economie',          swatch: '#a855f7' },
  energie:       { color: '#b45309', fill: '#fb923c', label: 'Energies renouvelables & Climat',swatch: '#f97316' },
  agriculture:   { color: '#15803d', fill: '#86efac', label: 'Agriculture & PAC',              swatch: '#22c55e' },
  eau:           { color: '#0369a1', fill: '#38bdf8', label: 'Eau, cours d\'eau & SAGE',       swatch: '#0ea5e9' },
  biodiversite:  { color: '#065f46', fill: '#6ee7b7', label: 'Biodiversite & Foret',           swatch: '#10b981' },
  risques:       { color: '#b91c1c', fill: '#fca5a5', label: 'Risques naturels & DDRM',       swatch: '#ef4444' },
  urbanisme:     { color: '#6d28d9', fill: '#ddd6fe', label: 'Urbanisme & Amenagement',        swatch: '#8b5cf6' },
  habitat:       { color: '#be185d', fill: '#f9a8d4', label: 'Habitat & Logement',             swatch: '#ec4899' },
  mobilite:      { color: '#c2410c', fill: '#fdba74', label: 'Mobilites & Securite routiere',  swatch: '#f97316' },
  patrimoine:    { color: '#78350f', fill: '#d97706', label: 'Patrimoine & Archeologie',       swatch: '#b45309' },
};


/* ════════════════════════════════════════════════════════════════════
   SOUS-TYPES DE PROJETS
   Chaque type de projet dispose de sous-types plus specifiques.
   Ils affinent le menu de selection et conditionnent la checklist.
   Structure : { ico, label, desc, cat (categorie reglementaire) }
   ════════════════════════════════════════════════════════════════════ */
var SOUS_TYPES = {

  logement: [
    { id:'maison',       ico:'&#x1F3E0;', label:'Maison individuelle',            desc:'Construction neuve d\'une maison individuelle ou de ses annexes (garage, piscine...)' },
    { id:'lotissement',  ico:'&#x1F3D8;', label:'Lotissement / Division',          desc:'Division d\'un terrain en plusieurs lots constructibles' },
    { id:'collectif',    ico:'&#x1F3E2;', label:'Immeuble collectif (logts)',      desc:'Batiment de plusieurs logements superposés (R+1 ou plus)' },
    { id:'extension',    ico:'&#x1F4D0;', label:'Extension / Rehabilitation',   desc:'Agrandissement ou rehabilitation d\'une habitation existante' },
    { id:'hlm',          ico:'&#x1F3E7;', label:'Logement social (HLM)',           desc:'Operation de logements locatifs sociaux (PLAI, PLUS, PLS)' },
    { id:'residence',    ico:'&#x1F6CC;', label:'Residence services',              desc:'Residence etudiante, senior, tourisme, affaires' },
    { id:'camping',      ico:'&#x26FA;',  label:'Camping / Hebergement touristique',  desc:'Creation ou extension d\'un terrain de camping ou de gites' },
  ],

  zae: [
    { id:'artisanat',    ico:'&#x1F528;', label:'Artisanat / Atelier',             desc:'Atelier de production artisanale, garage, menuiserie...' },
    { id:'commerce',     ico:'&#x1F6CD;', label:'Commerce de detail',           desc:'Supermarche, boutique, restaurant, cafe, hotel...' },
    { id:'bureau',       ico:'&#x1F4BC;', label:'Bureau / Tertiaire',              desc:'Bureaux, cabinet medical, agence, coworking...' },
    { id:'industrie',    ico:'&#x1F3ED;', label:'Site industriel / Entrepot',   desc:'Usine, entrepot logistique, plateforme de stockage' },
    { id:'logistique',   ico:'&#x1F69A;', label:'Plateforme logistique',        desc:'Entrepot de distribution, hub logistique, transit' },
    { id:'agricole_bat', ico:'&#x1F69C;', label:'Batiment agricole (hangar)',      desc:'Hangar agricole, silo, stabulation, serre' },
    { id:'parc_act',     ico:'&#x1F5FA;', label:'Parc d\'activites (ZAE)',         desc:'Creation ou extension d\'une zone d\'activites economiques' },
  ],

  equipement: [
    { id:'ecole',        ico:'&#x1F4DA;', label:'Ecole / College / Lycee',     desc:'Etablissement d\'enseignement de la maternelle au lycee' },
    { id:'sante',        ico:'&#x1F3E5;', label:'Etablissement de sante',       desc:'Hopital, clinique, maison de sante, EHPAD, creche...' },
    { id:'sport',        ico:'&#x26BD;',  label:'Equipement sportif',           desc:'Gymnase, stade, piscine, salle polyvalente...' },
    { id:'culture',      ico:'&#x1F3AD;', label:'Equipement culturel',          desc:'Mediatheque, cinema, salle de spectacle, musee...' },
    { id:'culte',        ico:'&#x26EA;',  label:'Lieu de culte',                desc:'Eglise, mosquee, synagogue, temple, salle associative...' },
    { id:'administratif',ico:'&#x1F3DB;', label:'Batiment administratif',       desc:'Mairie, tresorerie, commissariat, tribunal...' },
    { id:'technique',    ico:'&#x2699;',  label:'Batiment technique',              desc:'Caserne pompiers, dechetterie, station epuration...' },
    { id:'hebergement',  ico:'&#x1F6CF;', label:'Hebergement social',           desc:'CHRS, foyer de travailleurs, residence sociale...' },
  ],

  energie: [
    { id:'pv_toiture',   ico:'&#x2600;',  label:'Panneaux PV sur toiture',      desc:'Installation photovoltaique sur batiment existant ou neuf' },
    { id:'pv_sol',       ico:'&#x1F315;', label:'Centrale PV au sol',           desc:'Centrale solaire au sol, agrivoltaisme' },
    { id:'eolien',       ico:'&#x1F32C;', label:'Parc eolien',                  desc:'Installation d\'eoliennes terrestres' },
    { id:'biomasse',     ico:'&#x1F332;', label:'Chaufferie biomasse',          desc:'Chaufferie bois, methanisation, reseau de chaleur' },
    { id:'hydrogene',    ico:'&#x1F4A7;', label:'Installation hydrogene',       desc:'Electrolyse, stockage, distribution d\'hydrogene vert' },
    { id:'stockage',     ico:'&#x1F50B;', label:'Stockage energie (batterie)',  desc:'Station de stockage par batteries ou autre vecteur' },
    { id:'step',         ico:'&#x1F30A;', label:'Station hydroelectrique',        desc:'Microcentrale sur cours d\'eau, barrage' },
    { id:'ombriere',     ico:'&#x1F697;', label:'Ombriere PV (parking)',        desc:'Ombriere photovoltaique sur parc de stationnement (loi APER)' },
  ],

  transport: [
    { id:'voirie',       ico:'&#x1F6E3;', label:'Voirie communale / RD',        desc:'Creation ou modification d\'une voie publique' },
    { id:'parking',      ico:'&#x1F17F;', label:'Parc de stationnement',        desc:'Creation d\'un parking, aire de retournement...' },
    { id:'piste_velo',   ico:'&#x1F6B2;', label:'Piste / Voie cyclable',        desc:'Piste cyclable, voie verte, coulée verte' },
    { id:'gare',         ico:'&#x1F686;', label:'Gare / Pole d\'echanges',      desc:'Gare ferroviaire, routiere, pole multimodal' },
    { id:'pont',         ico:'&#x1F309;', label:'Ouvrage d\'art (pont)',         desc:'Construction ou rehabilitation d\'un pont ou passerelle' },
    { id:'giratoire',    ico:'&#x1F503;', label:'Giratoire / Carrefour',           desc:'Amenagement d\'un carrefour ou d\'un giratoire' },
  ],

  agriculture: [
    { id:'elevage',      ico:'&#x1F404;', label:'Elevage (bovin, ovin...)',      desc:'Batiment d\'elevage, fumiere, stabulation, silo fourrager' },
    { id:'maraichage',   ico:'&#x1F955;', label:'Maraichage / Horticulture',       desc:'Serre maraichere, abris de culture, serre horticole' },
    { id:'cereales',     ico:'&#x1F33E;', label:'Grandes cultures (cereales)',    desc:'Exploitation cerealiere, oleagineux, proteagineux' },
    { id:'vente_directe',ico:'&#x1F371;', label:'Vente directe / Circuit court',  desc:'Magasin a la ferme, marche de producteurs, drive fermier' },
    { id:'bio',          ico:'&#x1F343;', label:'Agriculture biologique',       desc:'Conversion ou maintien en agriculture biologique' },
    { id:'agrivoltaisme',ico:'&#x2600;',  label:'Agrivoltaisme',                desc:'Association production agricole et photovoltaique' },
    { id:'irrigation',   ico:'&#x1F4A7;', label:'Irrigation / Retenue eau',     desc:'Forage, pompage, retenue collinaire, bassine' },
  ],

  nature: [
    { id:'parc_urbain',  ico:'&#x1F33B;', label:'Parc / Jardin public',         desc:'Creation ou requalification d\'un espace vert public' },
    { id:'renaturation', ico:'&#x1F331;', label:'Renaturation / Desimpermeabilisation',  desc:'Suppression de surfaces impermeabilisees, creation de noues' },
    { id:'foret',        ico:'&#x1F332;', label:'Boisement / Reboisement',        desc:'Plantation forestiere, reboisement apres coupe rase' },
    { id:'zh_restauration',ico:'&#x1F986;',label:'Restauration zone humide',     desc:'Renaturalisation d\'une zone humide degradee' },
    { id:'cours_eau',    ico:'&#x1F30A;', label:'Restauration cours d\'eau',     desc:'Effacement d\'ouvrage, renaturation du lit, restauration' },
    { id:'piste_nature', ico:'&#x1F97E;', label:'Sentier / Chemin de randonnee',   desc:'Creation ou balisage d\'un sentier de randonnee ou de VTT' },
  ],

  friche: [
    { id:'friche_ind',   ico:'&#x1F3ED;', label:'Friche industrielle',          desc:'Ancienne usine, site minier, site chimique...' },
    { id:'friche_comm',  ico:'&#x1F6CD;', label:'Friche commerciale',              desc:'Ancien centre commercial, hypermarche, galerie...' },
    { id:'friche_mil',   ico:'&#x1F6E1;', label:'Friche militaire',             desc:'Ancienne base militaire, caserne, zone de defense' },
    { id:'friche_agri',  ico:'&#x1F33E;', label:'Friche agricole',              desc:'Anciens batiments agricoles abandonnes' },
    { id:'friche_fer',   ico:'&#x1F686;', label:'Friche ferroviaire',              desc:'Ancienne gare, voie ferree desaffectee, faisceau de triage' },
    { id:'renat_friche', ico:'&#x1F331;', label:'Renaturation de friche',          desc:'Conversion d\'une friche en espace vert ou naturel' },
  ],
};

/* ════════════════════════════════════════════════════════════════════
   CHECKLISTS ADMINISTRATIVES
   Chaque sous-type possede sa propre checklist d\'etapes.
   Structure de chaque etape :
     { id, phase (avant/instruction/travaux/reception/post),
       label, desc, delai, obligatoire, lien }
   ════════════════════════════════════════════════════════════════════ */
var CHECKLISTS = {

  /* ── MAISON INDIVIDUELLE ──────────────────────────────────────── */
  maison: [
    { id:'mi1',  phase:'avant',       ico:'&#x1F50D;', label:'Verification du PLU / zonage',              delai:'Avant tout projet',    oblig:true,  desc:'Consulter le document d\'urbanisme de la commune : zone UA, UB, UC, A, N... Verifier le reglement de zone applicable.' },
    { id:'mi2',  phase:'avant',       ico:'&#x26A0;',  label:'Consultation du risque radon',              delai:'Avant achat du terrain', oblig:false, desc:'Verifier si la commune est en zone a potentiel radon. Prevoir une membrane anti-radon en construction.' },
    { id:'mi3',  phase:'avant',       ico:'&#x1F30A;', label:'Verification risques naturels (PPRi, argiles)', delai:'Avant achat', oblig:true, desc:'Consulter le DDRM, le PPRi et la cartographie retrait-gonflement des argiles (BRGM). Verifier si une etude geotechnique G1+G2 est obligatoire.' },
    { id:'mi4',  phase:'avant',       ico:'&#x1F4CF;', label:'Bornage du terrain (geometre)',             delai:'Avant PC',             oblig:true,  desc:'Faire realiser un bornage contradictoire par un geometre-expert pour fixer les limites de la propriete.' },
    { id:'mi5',  phase:'avant',       ico:'&#x1F4BB;', label:'Etude geotechnique G1 (si argiles)',        delai:'Avant PC',             oblig:false, desc:'Obligatoire si le terrain est en zone d\'exposition argiles moyenne ou forte (loi ELAN 2018). Commandez aupres d\'un bureau geotechnique.' },
    { id:'mi6',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot du Permis de Construire (PC)',        delai:'J0',                   oblig:true,  desc:'Depot en mairie ou sur le portail Geozone. Dossier : CERFA 13406, plan de situation, plan masse, coupes, facades, insertion paysagere, notice.' },
    { id:'mi7',  phase:'instruction', ico:'&#x1F4C5;', label:'Instruction du dossier (2 mois)',           delai:'J0 + 2 mois',          oblig:true,  desc:'Delai de droit commun : 2 mois. Porte a 3 mois en secteur protege (Natura 2000, ABF). Silence vaut accord a l\'expiration du delai.' },
    { id:'mi8',  phase:'instruction', ico:'&#x1F4DE;', label:'Consultation ABF si perimetre MH',         delai:'Dans l\'instruction',  oblig:false, desc:'Si le projet est dans le perimetre de 500m d\'un MH, l\'ABF (UDAP 90) donne un avis conforme : son accord est obligatoire.' },
    { id:'mi9',  phase:'instruction', ico:'&#x1F6A7;', label:'Affichage PC en mairie et sur le terrain', delai:'Des la delivrance',     oblig:true,  desc:'Le PC doit etre affiche sur le terrain de facon visible depuis la voie publique pendant toute la duree des travaux.' },
    { id:'mi10', phase:'instruction', ico:'&#x23F3;',  label:'Delai de recours des tiers (2 mois)',      delai:'Apres affichage',       oblig:true,  desc:'Les tiers ont 2 mois a compter de l\'affichage sur le terrain pour contester le PC. Attendre avant de commencer les travaux.' },
    { id:'mi11', phase:'travaux',     ico:'&#x1F6A7;', label:'Declaration d\'ouverture de chantier (DOC)', delai:'Avant 1ers travaux', oblig:true,  desc:'Deposer le formulaire CERFA 13407 en mairie avant le commencement des travaux.' },
    { id:'mi12', phase:'travaux',     ico:'&#x1F3D7;', label:'Respect des prescriptions architecturales', delai:'Pendant travaux',     oblig:true,  desc:'Respecter les conditions posees dans le PC : materiaux, couleurs, implantation, hauteur, distances aux limites.' },
    { id:'mi13', phase:'travaux',     ico:'&#x1F4A7;', label:'Raccordements reseaux (eau, elec, ANC)',   delai:'Pendant travaux',      oblig:true,  desc:'Contacter le gestionnaire de reseaux (Enedis, operateur eau) pour les raccordements. ANC si pas de reseau collectif.' },
    { id:'mi14', phase:'reception',   ico:'&#x1F4DD;', label:'Declaration attestant l\'achevement (DAACT)', delai:'Fin chantier',     oblig:true,  desc:'Deposer le formulaire CERFA 13408 dans les 90 jours suivant l\'achevement des travaux.' },
    { id:'mi15', phase:'post',        ico:'&#x2705;',  label:'Visite de conformite possible',            delai:'Dans les 3 mois',      oblig:false, desc:'La mairie peut venir verifier la conformite des travaux avec le PC dans les 3 mois suivant la DAACT.' },
    { id:'mi16', phase:'post',        ico:'&#x1F3E0;', label:'Taxe d\'amenagement (TA)',                 delai:'Apres DAACT',          oblig:true,  desc:'Reglement de la taxe d\'amenagement aupres de la DDT (si superficie > 5 m2 de surface taxable). Comprend la part communale et departementale.' },
  ],

  /* ── LOTISSEMENT ─────────────────────────────────────────────── */
  lotissement: [
    { id:'lt1',  phase:'avant',       ico:'&#x1F50D;', label:'Faisabilite fonciere et PLU',              delai:'En amont',             oblig:true,  desc:'Verifier la zone du PLU, la surface minimale des lots, le COS eventuel, les regles de division parcellaire.' },
    { id:'lt2',  phase:'avant',       ico:'&#x1F4CF;', label:'Geometre : plan de division et bornage',  delai:'Avant PA',             oblig:true,  desc:'Faire realiser un plan topographique et un plan de division par un geometre-expert.' },
    { id:'lt3',  phase:'avant',       ico:'&#x1F4BB;', label:'Etude d\'impact (si >50 lots)',            delai:'Avant PA',             oblig:false, desc:'Obligatoire si le lotissement cree plus de 50 lots ou depasse 5 ha. A faire realiser par un bureau d\'etudes environnemental.' },
    { id:'lt4',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot du Permis d\'Amenager (PA)',         delai:'J0',                   oblig:true,  desc:'CERFA 13409. Dossier : plan de situation, notice, plan d\'amenagement, reglement (si applicable), etude d\'impact si requise.' },
    { id:'lt5',  phase:'instruction', ico:'&#x1F4C5;', label:'Instruction PA (3 mois)',                  delai:'J0 + 3 mois',          oblig:true,  desc:'Delai standard 3 mois pour un PA. Consultations : DDT, ABF si perimetre MH, SDIS, gestionnaires de reseaux.' },
    { id:'lt6',  phase:'instruction', ico:'&#x1F4CB;', label:'Cahier des Charges de Cession (CCC)',     delai:'Avant commercialisation', oblig:false, desc:'Document contractuel encadrant les modalites de cession des lots. Obligatoire si le lotissement comporte plus de 5 lots avec espaces communs.' },
    { id:'lt7',  phase:'travaux',     ico:'&#x1F6A7;', label:'VRD (viabilisation lots)',                delai:'Avant vente',           oblig:true,  desc:'Realisation des voiries, reseaux divers (eau, electricite, assainissement, telecom) avant la commercialisation des lots.' },
    { id:'lt8',  phase:'reception',   ico:'&#x1F4DD;', label:'DAACT + conformite des VRD',              delai:'Fin travaux',           oblig:true,  desc:'Certification de l\'achevement des VRD. Les lots peuvent etre vendus des la delivrance du PA si garantie d\'achevement.' },
    { id:'lt9',  phase:'post',        ico:'&#x1F4C4;', label:'PC pour chaque lot',                      delai:'Par acquereur',         oblig:true,  desc:'Chaque acquereur doit deposer un PC conforme au reglement du lotissement avant de construire.' },
  ],

  /* ── IMMEUBLE COLLECTIF ──────────────────────────────────────── */
  collectif: [
    { id:'ic1',  phase:'avant',       ico:'&#x1F50D;', label:'Etude de faisabilite et programme',       delai:'En amont',             oblig:true,  desc:'Etude de marche, programme de logements (surface, typologies, loyers), etude de sol, analyse du PLU.' },
    { id:'ic2',  phase:'avant',       ico:'&#x1F4C4;', label:'Consultation architectes (concours)',     delai:'Avant PC',             oblig:false, desc:'Obligatoire pour les maitres d\'ouvrage publics (> seuil UE). Facultatif pour les promoteurs prives.' },
    { id:'ic3',  phase:'avant',       ico:'&#x1F333;', label:'Etude impact si >40 000 m2 SDP',         delai:'Avant PC',             oblig:false, desc:'L\'etude d\'impact est requise au-dela de certains seuils. Se renseigner aupres de la DDT 90.' },
    { id:'ic4',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC (CERFA 13406)',                  delai:'J0',                   oblig:true,  desc:'Dossier complet : plans, coupes, facades, notice RE2020, etude geotechnique, etude insertion paysagere.' },
    { id:'ic5',  phase:'instruction', ico:'&#x1F4C5;', label:'Instruction PC (3 mois + 1 si ERP)',      delai:'J0 + 3 mois',          oblig:true,  desc:'3 mois pour un batiment d\'habitation collectif. Commission de securite et accessibilite si ERP en RDC.' },
    { id:'ic6',  phase:'instruction', ico:'&#x2665;',  label:'Loi SRU : 25% logements sociaux',        delai:'Avant PC',             oblig:false, desc:'Si la commune est soumise a la loi SRU : 25% de logements sociaux obligatoires dans les operations de plus de 12 logements.' },
    { id:'ic7',  phase:'travaux',     ico:'&#x1F6A7;', label:'DOC + affichage chantier',               delai:'Avant 1ers travaux',   oblig:true,  desc:'Declaration d\'ouverture de chantier CERFA 13407. Panneaux de chantier reglementaires.' },
    { id:'ic8',  phase:'travaux',     ico:'&#x1F3E0;', label:'Conformite RE2020',                      delai:'Pendant travaux',       oblig:true,  desc:'Respecter les exigences de la RE2020 : seuil carbone, seuil energie primaire, confort d\'ete.' },
    { id:'ic9',  phase:'reception',   ico:'&#x1F4DD;', label:'DAACT + achevement',                     delai:'Fin chantier',          oblig:true,  desc:'DAACT dans les 90 jours. Verifier la conformite avant livraison.' },
    { id:'ic10', phase:'post',        ico:'&#x1F4B0;', label:'Taxe d\'amenagement',                    delai:'Apres DAACT',           oblig:true,  desc:'Calcul de la TA sur les surfaces creees. La DDT 90 emet le titre de perception.' },
  ],

  /* ── COMMERCE ────────────────────────────────────────────────── */
  commerce: [
    { id:'co1',  phase:'avant',       ico:'&#x1F50D;', label:'Verification du PLU (zone UX, UA...)',   delai:'En amont',             oblig:true,  desc:'Les commerces sont autorises en zones urbaines mixtes (UA, UB). Verifier les dispositions du reglement de zone.' },
    { id:'co2',  phase:'avant',       ico:'&#x1F6CD;', label:'Autorisation CDAC si >1000 m2',          delai:'Avant PC',             oblig:false, desc:'Toute creation de surface commerciale > 1000 m2 necessite l\'autorisation de la Commission Departementale d\'Amenagement Commercial (CDAC).' },
    { id:'co3',  phase:'avant',       ico:'&#x267F;',  label:'Etude accessibilite PMR',                delai:'Avant PC',             oblig:true,  desc:'Les ERP sont soumis a l\'accessibilite universelle. Faire realiser un diagnostic accessibilite par un bureau specialise.' },
    { id:'co4',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC (si > 20 m2 SP)',               delai:'J0',                   oblig:true,  desc:'PC obligatoire pour toute construction nouvelle de plus de 20 m2 de surface de plancher. DP si < 20 m2.' },
    { id:'co5',  phase:'instruction', ico:'&#x1F691;', label:'Consultation SDIS (securite incendie)',  delai:'Dans instruction',     oblig:true,  desc:'Le SDIS est consulte pour les ERP. Regles de securite : degagement, compartimentage, alarme, extincteurs.' },
    { id:'co6',  phase:'travaux',     ico:'&#x1F6A7;', label:'DOC + chantier',                        delai:'Avant 1ers travaux',   oblig:true,  desc:'Declaration d\'ouverture de chantier. Respect des conditions du PC (facades, enseigne, accessibilite).' },
    { id:'co7',  phase:'reception',   ico:'&#x1F4DD;', label:'Visite commission securite ERP',        delai:'Avant ouverture',       oblig:true,  desc:'Obligatoire avant l\'ouverture au public pour les ERP de 1ere a 4eme categorie. Obtenir l\'avis favorable.' },
    { id:'co8',  phase:'post',        ico:'&#x1F4DC;', label:'Declaration d\'activite (CFE, etc.)',    delai:'Avant ouverture',       oblig:true,  desc:'Immatriculation au RCS ou repertoire des metiers selon l\'activite. Declaration au Centre de Formalites des Entreprises.' },
  ],

  /* ── BUREAU / TERTIAIRE ──────────────────────────────────────── */
  bureau: [
    { id:'bu1',  phase:'avant',       ico:'&#x1F50D;', label:'Verification PLU et zonage',             delai:'En amont',             oblig:true,  desc:'Les bureaux sont autorises en zones UA, UB, UX selon le PLU. Verifier les coefficients et les destinations autorisees.' },
    { id:'bu2',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC ou DP selon surface',           delai:'J0',                   oblig:true,  desc:'DP si < 20 m2 de SP. PC si > 20 m2. Dossier complet avec justificatif RE2020 pour les surfaces > 1000 m2.' },
    { id:'bu3',  phase:'instruction', ico:'&#x1F4BB;', label:'Decret BACS si > 290 kW',               delai:'Dans instruction',     oblig:false, desc:'Automatisation des systemes energetiques obligatoire pour les batiments tertiaires > 290 kW (decret BACS 2021).' },
    { id:'bu4',  phase:'travaux',     ico:'&#x2699;',  label:'Respect RE2020 et decret tertiaire',    delai:'Pendant travaux',       oblig:true,  desc:'RE2020 pour les constructions neuves. Decret tertiaire pour les batiments > 1000 m2 : -40% conso en 2030.' },
    { id:'bu5',  phase:'reception',   ico:'&#x1F4DD;', label:'DAACT + mise en conformite',            delai:'Fin chantier',          oblig:true,  desc:'DAACT dans les 90 jours. Verifier la conformite avant occupation.' },
  ],

  /* ── INDUSTRIE / ENTREPOT ─────────────────────────────────────── */
  industrie: [
    { id:'in1',  phase:'avant',       ico:'&#x1F50D;', label:'Verification zonage PLU (UX, AU)',       delai:'En amont',             oblig:true,  desc:'Zones UX ou AUx pour les activites industrielles. Verifier les nuisances tolerees selon le reglement de zone.' },
    { id:'in2',  phase:'avant',       ico:'&#x2623;',  label:'Diagnostic BASIAS/BASOL si friche',     delai:'Avant achat',           oblig:false, desc:'Si le site est une ancienne friche industrielle, consulter BASIAS et BASOL. Realiser une ESE Phase 1.' },
    { id:'in3',  phase:'avant',       ico:'&#x1F4BB;', label:'Classement ICPE (si activite classee)', delai:'Avant PC',             oblig:false, desc:'Verifier si l\'activite est soumise a la reglementation ICPE (rubrique de nomenclature). 3 regimes : declaration, enregistrement, autorisation.' },
    { id:'in4',  phase:'avant',       ico:'&#x1F333;', label:'Etude d\'impact si ICPE autorisation',  delai:'Avant instruction',    oblig:false, desc:'Obligatoire pour les ICPE en regime d\'autorisation. A faire realiser par un bureau d\'etudes agree.' },
    { id:'in5',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC + ICPE si requis',             delai:'J0',                   oblig:true,  desc:'PC pour la partie construction. Dossier ICPE parallele si activite classee. Les deux instructions sont liees.' },
    { id:'in6',  phase:'instruction', ico:'&#x23F3;',  label:'Enquete publique ICPE autorisation',    delai:'J0 + 4 a 6 mois',      oblig:false, desc:'Obligatoire pour les ICPE en regime d\'autorisation. Organisation par le prefet apres le depot du dossier.' },
    { id:'in7',  phase:'travaux',     ico:'&#x1F6A7;', label:'DOC + conformite ICPE',                 delai:'Avant 1ers travaux',   oblig:true,  desc:'DOC pour les travaux. L\'exploitant doit notifier le debut d\'exploitation a l\'inspection des ICPE.' },
    { id:'in8',  phase:'post',        ico:'&#x1F4CB;', label:'Suivi inspection ICPE',                 delai:'En continu',            oblig:false, desc:'Les ICPE sont soumises a des inspections regulieres. Tenir un registre des contr-les et des incidents.' },
  ],

  /* ── PARC PV AU SOL ──────────────────────────────────────────── */
  pv_sol: [
    { id:'pv1',  phase:'avant',       ico:'&#x1F50D;', label:'Faisabilite : zonage, contraintes',      delai:'En amont',             oblig:true,  desc:'Verifier le zonage PLU (zone A ou N en general), les contraintes Natura 2000, ZNIEFF, covisibilite MH, potentiel PV (Atlas C22).' },
    { id:'pv2',  phase:'avant',       ico:'&#x1F333;', label:'Inventaires naturalistes (4 saisons)',   delai:'Avant PC',             oblig:true,  desc:'Avifaune, chiropteres, flore, insectes, reptiles. Minimum 4 saisons de prospection. Bureau d\'etudes naturaliste agree.' },
    { id:'pv3',  phase:'avant',       ico:'&#x1F4BB;', label:'Evaluation incidences Natura 2000',     delai:'Avant PC',             oblig:false, desc:'Obligatoire si le projet peut affecter un site Natura 2000. La DDT 90 guide la procedure.' },
    { id:'pv4',  phase:'avant',       ico:'&#x2600;',  label:'Dossier de raccordement Enedis/RTE',    delai:'Avant PC',             oblig:true,  desc:'Contacter Enedis ou RTE selon la puissance pour obtenir une proposition de raccordement (PTF). Duree : 3 a 6 mois.' },
    { id:'pv5',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC (CERFA 13406)',                delai:'J0',                   oblig:true,  desc:'Dossier complet avec etude paysagere, etude d\'impact si > 5 ha, etude ecologique, notice ICPE si applicable.' },
    { id:'pv6',  phase:'instruction', ico:'&#x23F3;',  label:'Instruction PC + avis DREAL',           delai:'J0 + 3 a 5 mois',      oblig:true,  desc:'Avis de la DREAL, de l\'UDAP (si covisibilite MH), du gestionnaire reseau. Possible enquete publique > 250 kWc.' },
    { id:'pv7',  phase:'instruction', ico:'&#x1F4B0;', label:'Appel d\'offres CRE si > 500 kWc',     delai:'Avant construction',   oblig:false, desc:'Pour les projets > 500 kWc, depot d\'une offre dans le cadre des appels d\'offres de la Commission de Regulation de l\'Energie.' },
    { id:'pv8',  phase:'travaux',     ico:'&#x1F6A7;', label:'DOC + suivi chantier (naturaliste)',    delai:'Avant 1ers travaux',   oblig:true,  desc:'DOC. Suivi de chantier par un naturaliste pour eviter l\'impact sur les especes protegees.' },
    { id:'pv9',  phase:'post',        ico:'&#x1F331;', label:'Mesures ERC : suivi / compensation',    delai:'Post-chantier',         oblig:false, desc:'Si des mesures compensatoires ont ete imposees (especes, zones humides), en assurer le suivi annuel.' },
    { id:'pv10', phase:'post',        ico:'&#x1F504;', label:'Remise en etat apres exploitation',    delai:'Fin de vie 25-30 ans',  oblig:true,  desc:'L\'exploitant doit provisionner et realiser le demantelement et la remise en etat du site a la fin de vie de la centrale.' },
  ],

  /* ── PARC EOLIEN ─────────────────────────────────────────────── */
  eolien: [
    { id:'eo1',  phase:'avant',       ico:'&#x1F50D;', label:'Zone de Developpement de l\'Eolien (ZDE)', delai:'En amont',         oblig:false, desc:'Verifier les documents de planification energetique (SRADDET, SCoT). Zones favorables cartographiees dans l\'Atlas DDT 90 (C24).' },
    { id:'eo2',  phase:'avant',       ico:'&#x1F3D9;', label:'Etude de vent (minimum 1 an)',           delai:'Avant depot',           oblig:true,  desc:'Installation d\'un mat de mesure pendant au moins 12 mois pour caracteriser le gisement eolien.' },
    { id:'eo3',  phase:'avant',       ico:'&#x1F333;', label:'Inventaires naturalistes (4 saisons)',   delai:'Avant depot',           oblig:true,  desc:'Avifaune, chiropteres minimum 4 saisons. Expertise naturaliste approfondie necessaire.' },
    { id:'eo4',  phase:'avant',       ico:'&#x1F4BB;', label:'Etudes acoustique et visuelle',         delai:'Avant depot',           oblig:true,  desc:'Etude d\'impact acoustique (emergence maximale 3 dB(A) de nuit) et etude paysagere avec photomontages.' },
    { id:'eo5',  phase:'avant',       ico:'&#x1F4E1;', label:'Servitudes aeronautiques et radars',    delai:'Avant depot',           oblig:true,  desc:'Consultation de la DGAC, de la DGA, de Meteo-France. Les servitudes peuvent interdire ou contraindre les hauteurs.' },
    { id:'eo6',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot dossier ICPE Autorisation',       delai:'J0',                   oblig:true,  desc:'Les eoliennes sont des ICPE soumises a autorisation (regime unique). Dossier + etude d\'impact + etude de danger.' },
    { id:'eo7',  phase:'instruction', ico:'&#x23F3;',  label:'Enquete publique (3 mois)',             delai:'J0 + 6 a 12 mois',     oblig:true,  desc:'Enquete publique organisee par le prefet apres avis du commissaire enqueteur. Recours frequents en contentieux.' },
    { id:'eo8',  phase:'instruction', ico:'&#x1F4B0;', label:'Appel d\'offres CRE (si tarif S17)',    delai:'Avant construction',   oblig:false, desc:'Pour les projets > 18 MW en 2025, obligation de participer aux appels d\'offres de la CRE pour obtenir un contrat de soutien.' },
    { id:'eo9',  phase:'travaux',     ico:'&#x1F6A7;', label:'Bridage chantier (chiropteres, avifaune)', delai:'Pendant travaux',  oblig:true,  desc:'Arret des travaux lors des periodes de migration ou de reproduction sensibles selon le calendrier naturaliste.' },
    { id:'eo10', phase:'post',        ico:'&#x1F9E0;', label:'Suivi environnemental annuel',          delai:'Annuel (5 ans)',        oblig:true,  desc:'Suivi de la mortalite avifaune et chiropteres. Bridage operationnel si depassement des seuils.' },
  ],

  /* ── ECOLE ────────────────────────────────────────────────────── */
  ecole: [
    { id:'ec1',  phase:'avant',       ico:'&#x1F465;', label:'Etude de besoins demographiques',       delai:'En amont',             oblig:true,  desc:'Estimer la population scolaire sur 10 ans. Calibrer le projet : nombre de classes, services (garderie, cantine, gymnase).' },
    { id:'ec2',  phase:'avant',       ico:'&#x267F;',  label:'Programme architectural + accessibilite', delai:'Avant PC',          oblig:true,  desc:'Programme fonctionnel : surfaces, flux, materiaux. Accessibilite universelle (loi 2005) obligatoire.' },
    { id:'ec3',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC (ERP IVe cat. ou +)',           delai:'J0',                  oblig:true,  desc:'Dossier complet avec notice accessibilite, notice securite incendie, etude thermique RE2020.' },
    { id:'ec4',  phase:'instruction', ico:'&#x1F4DE;', label:'Avis Inspection Academique',            delai:'Dans instruction',     oblig:true,  desc:'L\'Inspection Academique est consultee pour valider le programme et le calendrier de livraison.' },
    { id:'ec5',  phase:'instruction', ico:'&#x1F691;', label:'Avis SDIS (securite incendie ERP)',     delai:'Dans instruction',     oblig:true,  desc:'Le SDIS valide les conditions de securite incendie : degagement, desenfumage, alarme, acces pompiers.' },
    { id:'ec6',  phase:'travaux',     ico:'&#x1F6A7;', label:'DOC + suivi de chantier',               delai:'Avant 1ers travaux',   oblig:true,  desc:'DOC en mairie. Mise en place du bureau de controle et du coordinateur SPS (securite et protection de la sante).' },
    { id:'ec7',  phase:'reception',   ico:'&#x1F4CB;', label:'Visite commission securite ERP',        delai:'Avant ouverture',       oblig:true,  desc:'Commission de securite composee de la mairie, SDIS et services de l\'Etat. Avis favorable obligatoire avant ouverture.' },
    { id:'ec8',  phase:'post',        ico:'&#x2705;',  label:'Visite periodique commission securite', delai:'Tous les 5 ans',        oblig:true,  desc:'Visite periodique de la commission de securite tous les 5 ans pour les ERP de 1ere a 4eme categorie.' },
  ],

  /* ── FRICHE INDUSTRIELLE ─────────────────────────────────────── */
  friche_ind: [
    { id:'fi1',  phase:'avant',       ico:'&#x2623;',  label:'Consultation BASIAS / BASOL',           delai:'Avant tout projet',    oblig:true,  desc:'Verifier si le site figure dans les inventaires nationaux des sites industriels et sols pollues. Acces gratuit en ligne.' },
    { id:'fi2',  phase:'avant',       ico:'&#x1F50D;', label:'Etude historique Phase 1 (ESE)',         delai:'Avant achat',           oblig:true,  desc:'Etude historique et documentaire, visite de terrain, identification des sources de pollution potentielles. Par un bureau agree.' },
    { id:'fi3',  phase:'avant',       ico:'&#x1F9EA;', label:'Campagne Phase 2 si risque identifie',  delai:'Apres Phase 1',         oblig:false, desc:'Prelevements sols et eaux souterraines, analyses en laboratoire, quantification de la pollution. Definit l\'usage compatible.' },
    { id:'fi4',  phase:'avant',       ico:'&#x1F4B0;', label:'Candidature Fonds Friches ADEME',       delai:'Avant travaux',         oblig:false, desc:'Deposer un dossier aupres de l\'ADEME (portail AGIR) pour obtenir une aide au financement de la depollution et de la rehabilitation.' },
    { id:'fi5',  phase:'avant',       ico:'&#x1F3E0;', label:'Consultation EPF BFC pour portage',     delai:'Avant achat',           oblig:false, desc:'L\'EPF BFC peut porter le foncier pendant l\'etude et la depollution. Contacter en amont pour evaluer la faisabilite.' },
    { id:'fi6',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC selon usage futur',            delai:'J0',                   oblig:true,  desc:'PC selon l\'usage futur du site (logements, ZAE, equipement...). Le plan de gestion definit les conditions de constructibilite.' },
    { id:'fi7',  phase:'instruction', ico:'&#x1F4CB;', label:'Plan de gestion (si pollution)',        delai:'Avant travaux',         oblig:false, desc:'Document contractuel entre l\'exploitant ou le proprietaire et l\'administration, definissant les mesures de gestion des sols.' },
    { id:'fi8',  phase:'travaux',     ico:'&#x1F6A7;', label:'Suivi pollution pendant terrassements', delai:'Pendant travaux',       oblig:false, desc:'Surveillance de la qualite de l\'air et des eaux souterraines pendant les travaux de terrassement. Gestion des terres excavees.' },
    { id:'fi9',  phase:'post',        ico:'&#x1F4CA;', label:'Attestation de conformite (certificat)', delai:'Fin chantier',         oblig:false, desc:'Si prevue dans le plan de gestion : attestation d\'un bureau certifie que les travaux ont ete realises conformement au plan.' },
    { id:'fi10', phase:'post',        ico:'&#x1F331;', label:'Renaturation si applicable',            delai:'Apres travaux',         oblig:false, desc:'Desimpermeabilisation, vegetalisation, gestion des eaux pluviales a la source. Eligible aux aides Fonds vert.' },
  ],

  /* ── VOIRIE ──────────────────────────────────────────────────── */
  voirie: [
    { id:'vo1',  phase:'avant',       ico:'&#x1F50D;', label:'Etude de trafic et de faisabilite',     delai:'En amont',             oblig:true,  desc:'Comptages trafic, etude de capacite, analyse de securite. Dimensionnement de la voirie selon le type et le trafic prevu.' },
    { id:'vo2',  phase:'avant',       ico:'&#x1F4BB;', label:'Etude d\'impact si RD ou echangeur',    delai:'Avant instruction',    oblig:false, desc:'Requise pour les routes departementales importantes et les echangeurs autoroutiers. Procedure du CGPPP.' },
    { id:'vo3',  phase:'avant',       ico:'&#x1F30A;', label:'Etude hydraulique si traverse de cours d\'eau', delai:'Avant DT',   oblig:false, desc:'Si la voirie franchit un cours d\'eau : dossier loi sur l\'eau (IOTA). Peut necessite une autorisation prefectorale.' },
    { id:'vo4',  phase:'instruction', ico:'&#x1F4C4;', label:'Declaration de Travaux (DT) ou DUP',    delai:'J0',                  oblig:true,  desc:'Declaration de Travaux si voirie communale. Declaration d\'Utilite Publique (DUP) si expropriation necessaire (> 3 mois).' },
    { id:'vo5',  phase:'instruction', ico:'&#x1F4BB;', label:'Consultation des concessionnaires',     delai:'Dans instruction',     oblig:true,  desc:'Informer les gestionnaires de reseaux enterres (eau, electricite, telecom, gaz) par DT/DICT avant tout terrassement.' },
    { id:'vo6',  phase:'travaux',     ico:'&#x1F6A7;', label:'DICT (Declaration Intention Commencement)', delai:'Avant travaux',   oblig:true,  desc:'3 jours avant tout chantier : envoyer la DICT aux concessionnaires de reseaux. Reponse dans les 9 jours.' },
    { id:'vo7',  phase:'reception',   ico:'&#x2705;',  label:'Reception des travaux et classement',   delai:'Fin chantier',          oblig:true,  desc:'PV de reception des travaux. Classement dans le domaine public communal par deliberation du conseil municipal.' },
  ],

  /* ── RENATURATION ────────────────────────────────────────────── */
  renaturation: [
    { id:'rn1',  phase:'avant',       ico:'&#x1F333;', label:'Etude de faisabilite ecologique',       delai:'En amont',             oblig:false, desc:'Diagnostic de l\'etat initial du site, potentiel de renaturation, especes a favoriser, contraintes foncières.' },
    { id:'rn2',  phase:'avant',       ico:'&#x1F4B0;', label:'Eligibilite Fonds vert / ADEME',       delai:'Avant travaux',         oblig:false, desc:'La renaturation est eligible aux aides du Fonds vert (volet cadre de vie) et des programmes ADEME. Deposer un dossier.' },
    { id:'rn3',  phase:'instruction', ico:'&#x1F4C4;', label:'DP ou PC selon les amenagements',      delai:'J0',                   oblig:false, desc:'DP pour les amenagements legers. PC si construction de kiosques, abris, WC. Aucune autorisation si simple plantation.' },
    { id:'rn4',  phase:'travaux',     ico:'&#x1F6A7;', label:'Travaux de desimpermeabilisation',     delai:'Pendant travaux',       oblig:false, desc:'Depose d\'enrobes, decapage, amendement des sols, plantation. Suivi par un ecologue.' },
    { id:'rn5',  phase:'post',        ico:'&#x1F4CA;', label:'Suivi ecologique post-travaux',         delai:'1 an puis periodique', oblig:false, desc:'Suivi de la recolonisation par la flore et la faune. Bilan annuel de la renaturation.' },
  ],

  /* ── ZONE HUMIDE ─────────────────────────────────────────────── */
  zh_restauration: [
    { id:'zh1',  phase:'avant',       ico:'&#x1F4CF;', label:'Delimitation zones humides (pedologie)', delai:'Avant tout projet',  oblig:true,  desc:'Sondages pedologiques et releves floristiques pour delimiter precisement les zones humides. Bureau d\'etudes agree.' },
    { id:'zh2',  phase:'avant',       ico:'&#x1F4BB;', label:'Dossier loi sur l\'eau (IOTA)',          delai:'Avant travaux',        oblig:true,  desc:'Declaration si 0,1 a 1 ha. Autorisation si > 1 ha. Depot a la DDT 90 (service Eau).' },
    { id:'zh3',  phase:'avant',       ico:'&#x1F4B0;', label:'Financement Agence de l\'eau RMC',      delai:'Avant travaux',         oblig:false, desc:'L\'agence de l\'eau RMC finance les projets de restauration de zones humides. Contacter la delegation de Besancon.' },
    { id:'zh4',  phase:'instruction', ico:'&#x23F3;',  label:'Instruction IOTA (2 a 6 mois)',         delai:'J0 + 2 a 6 mois',      oblig:true,  desc:'La DDT 90 instruit le dossier. Consultation du public, avis des services, enquete publique si autorisation.' },
    { id:'zh5',  phase:'travaux',     ico:'&#x1F6A7;', label:'Suivi de chantier (ecologue)',           delai:'Pendant travaux',       oblig:false, desc:'Un ecologue assure le suivi des travaux pour eviter l\'impact sur la faune et la flore de la zone humide.' },
    { id:'zh6',  phase:'post',        ico:'&#x1F4CA;', label:'Suivi hydrologique et ecologique',      delai:'5 ans apres travaux',   oblig:true,  desc:'Suivi annuel du niveau d\'eau, de la flore et de la faune. Rapport de suivi a la DDT 90.' },
  ],

  /* ── ELEVAGE ─────────────────────────────────────────────────── */
  elevage: [
    { id:'el1',  phase:'avant',       ico:'&#x1F50D;', label:'Verification zone PLU (zone A)',        delai:'En amont',             oblig:true,  desc:'Les batiments d\'elevage sont autorises en zone A des PLU. Verifier le reglement et les distances aux habitations.' },
    { id:'el2',  phase:'avant',       ico:'&#x1F4BB;', label:'Classement ICPE si seuils depassés',    delai:'Avant PC',             oblig:false, desc:'Bovins, porcins, volailles : verifier si l\'effectif depasse les seuils ICPE (declaration/enregistrement/autorisation).' },
    { id:'el3',  phase:'avant',       ico:'&#x1F4A7;', label:'Plan de fumure et stockage effluents',  delai:'Avant PC',             oblig:true,  desc:'Si en zone vulnerable nitrates : capacite de stockage minimum 6 mois. Plan de fumure previsionnel obligatoire.' },
    { id:'el4',  phase:'instruction', ico:'&#x1F4C4;', label:'Depot PC + ICPE si requis',             delai:'J0',                  oblig:true,  desc:'PC pour la construction. Dossier ICPE en parallele si applicable. Consultation de la Chambre d\'Agriculture.' },
    { id:'el5',  phase:'instruction', ico:'&#x1F4DE;', label:'Enquete publique ICPE (autorisation)',  delai:'J0 + 4 mois',          oblig:false, desc:'Obligatoire pour les ICPE en regime autorisation (grands elevages). Commissaire enqueteur designe par le tribunal.' },
    { id:'el6',  phase:'travaux',     ico:'&#x1F6A7;', label:'DOC + conformite ICPE',                 delai:'Avant 1ers travaux',   oblig:true,  desc:'DOC en mairie. Notification a l\'inspection ICPE avant le demarrage de l\'activite.' },
    { id:'el7',  phase:'post',        ico:'&#x1F4CB;', label:'Registre d\'elevage et declaration',    delai:'En continu',            oblig:true,  desc:'Tenir le registre d\'elevage obligatoire. Declarer les effectifs a la DDT et a la chambre d\'agriculture.' },
  ],

  /* ── PAC / BIO ───────────────────────────────────────────────── */
  bio: [
    { id:'bio1', phase:'avant',       ico:'&#x1F343;', label:'Periode de conversion (2-3 ans)',       delai:'En amont',             oblig:true,  desc:'La conversion en AB necessite une periode de 2 ans (cultures) ou 3 ans (elevage) sans produits chimiques de synthese.' },
    { id:'bio2', phase:'avant',       ico:'&#x1F4B0;', label:'Aide conversion AB (MAEC)',             delai:'Avant conversion',      oblig:false, desc:'Deposer une demande MAEC conversion AB avant le 15 mai aupres de la DDT 90 (PAC). Aide sur 5 ans.' },
    { id:'bio3', phase:'instruction', ico:'&#x1F4C4;', label:'Notification a l\'organisme certificateur', delai:'Avant conversion',  oblig:true,  desc:'Notifier aupres d\'un organisme certificateur agree (Ecocert, Bureau Veritas...) avant de commencer la conversion.' },
    { id:'bio4', phase:'travaux',     ico:'&#x1F52C;', label:'Audits annuels de certification',       delai:'Annuel',                oblig:true,  desc:'L\'organisme certificateur effectue des audits annuels pour maintenir la certification AB. Tenir un registre des pratiques.' },
    { id:'bio5', phase:'post',        ico:'&#x2705;',  label:'Obtention du certificat AB',             delai:'Apres conversion',      oblig:true,  desc:'A l\'issue de la periode de conversion, l\'organisme certificateur delivre le certificat AB valable 1 an (renouvelable).' },
  ],

  /* Fallback pour les sous-types sans checklist dediee */
  _default: [
    { id:'def1', phase:'avant',       ico:'&#x1F50D;', label:'Verification du PLU et du zonage',       delai:'En amont',             oblig:true,  desc:'Consulter le document d\'urbanisme applicable (PLU, carte communale, RNU) et identifier les regles de la zone.' },
    { id:'def2', phase:'avant',       ico:'&#x26A0;',  label:'Identification des risques naturels',    delai:'Avant achat / depot',   oblig:true,  desc:'Consulter le DDRM et les PPR applicable. Identifier les contraintes specifiques au site.' },
    { id:'def3', phase:'instruction', ico:'&#x1F4C4;', label:'Depot de la demande d\'autorisation',   delai:'J0',                   oblig:true,  desc:'Deposer le formulaire CERFA adapte en mairie ou sur la plateforme Geozone. Constituer un dossier complet.' },
    { id:'def4', phase:'instruction', ico:'&#x23F3;',  label:'Instruction de la demande',             delai:'Delai variable',        oblig:true,  desc:'Instruction par la mairie et les services consultes. Contacter la DDT 90 en amont pour anticiper les objections.' },
    { id:'def5', phase:'travaux',     ico:'&#x1F6A7;', label:'Declaration d\'ouverture de chantier',  delai:'Avant 1ers travaux',   oblig:true,  desc:'DOC en mairie et DICT aux concessionnaires de reseaux 3 jours avant le debut des travaux.' },
    { id:'def6', phase:'reception',   ico:'&#x1F4DD;', label:'Declaration d\'achevement (DAACT)',     delai:'Fin chantier',          oblig:true,  desc:'DAACT dans les 90 jours suivant l\'achevement des travaux.' },
    { id:'def7', phase:'post',        ico:'&#x1F4B0;', label:'Taxe d\'amenagement',                   delai:'Apres DAACT',           oblig:true,  desc:'Reglement de la taxe d\'amenagement et des taxes annexes (voirie, eau, assainissement).' },
  ],
};

/* ════════════════════════════════════════════════════════════════════
   DONNEES GEOGRAPHIQUES PAR CHAPITRE D'ATLAS
   ════════════════════════════════════════════════════════════════════ */
var COUCHES_DATA = {

  /* ── 1. ORGANISATION DU TERRITOIRE (C1–C8) ──────────────────────
     Infrastructures structurantes, EPCI, paysages, relief            */
  organisation: {
    type: 'FeatureCollection', features: [
      /* Axes routiers structurants (C7) */
      { type:'Feature', properties:{ nom:'Autoroute A36 (Rhin-Rhone)', cat:'Reseau routier C7', type:'autoroute' },
        geometry:{ type:'LineString', coordinates:[[6.640,47.578],[6.720,47.618],[6.860,47.637],[7.005,47.660],[7.120,47.678]] }},
      { type:'Feature', properties:{ nom:'Route Nationale RN19', cat:'Reseau routier C7', type:'nationale' },
        geometry:{ type:'LineString', coordinates:[[6.860,47.840],[6.860,47.740],[6.860,47.637],[6.860,47.520],[6.920,47.460]] }},
      { type:'Feature', properties:{ nom:'RD83 Belfort-Colmar', cat:'Reseau routier C7', type:'departementale' },
        geometry:{ type:'LineString', coordinates:[[6.860,47.637],[6.950,47.660],[7.050,47.700],[7.100,47.750]] }},
      { type:'Feature', properties:{ nom:'Ligne TGV Belfort-Montbeliard', cat:'Reseau ferroviaire C7', type:'TGV' },
        geometry:{ type:'LineString', coordinates:[[6.863,47.637],[6.895,47.615],[6.912,47.609]] }},
      { type:'Feature', properties:{ nom:'Ligne Paris-Mulhouse', cat:'Reseau ferroviaire C7', type:'TER' },
        geometry:{ type:'LineString', coordinates:[[6.710,47.660],[6.860,47.637],[7.000,47.620]] }},
      { type:'Feature', properties:{ nom:'Canal du Rhone au Rhin', cat:'Reseau fluvial C7', type:'canal' },
        geometry:{ type:'LineString', coordinates:[[6.740,47.590],[6.820,47.610],[6.900,47.620],[6.990,47.580]] }},
      /* Sièges des EPCI (C4) */
      { type:'Feature', properties:{ nom:'Belfort — Chef-lieu & siege GBCA', cat:'Intercommunalites C4', type:'epci' },
        geometry:{ type:'Point', coordinates:[6.863, 47.637] }},
      { type:'Feature', properties:{ nom:'Giromagny — Siege CCVS', cat:'Intercommunalites C4', type:'epci' },
        geometry:{ type:'Point', coordinates:[6.831, 47.743] }},
      { type:'Feature', properties:{ nom:'Delle — Siege CCST', cat:'Intercommunalites C4', type:'epci' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
      /* Pôles d'attraction (C5) */
      { type:'Feature', properties:{ nom:'Aire d\'attraction de Belfort (pole principal)', cat:'Aires attraction C5', type:'pole' },
        geometry:{ type:'Point', coordinates:[6.863, 47.637] }},
      { type:'Feature', properties:{ nom:'Aire d\'attraction de Delle (pole secondaire)', cat:'Aires attraction C5', type:'pole' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
      /* Unités de paysage (C8) — zones approximatives */
      { type:'Feature', properties:{ nom:'Montagne vosgienne (1/6 unites paysage C8)', cat:'Unites paysage C8', type:'paysage' },
        geometry:{ type:'Polygon', coordinates:[[[6.65,47.72],[6.82,47.72],[6.82,47.87],[6.65,47.87],[6.65,47.72]]] }},
      { type:'Feature', properties:{ nom:'Trouee de Belfort (2/6 unites paysage C8)', cat:'Unites paysage C8', type:'paysage' },
        geometry:{ type:'Polygon', coordinates:[[[6.78,47.58],[7.00,47.58],[7.00,47.70],[6.78,47.70],[6.78,47.58]]] }},
      { type:'Feature', properties:{ nom:'Plateaux du Jura (6/6 unites paysage C8)', cat:'Unites paysage C8', type:'paysage' },
        geometry:{ type:'Polygon', coordinates:[[[6.70,47.44],[7.05,47.44],[7.05,47.55],[6.70,47.55],[6.70,47.44]]] }},
    ]
  },

  /* ── 2. POPULATION, ECONOMIE ET SERVICES (C9–C15) ───────────────
     Emplois, revenus, programmes ACV/PVD, Fonds vert               */
  population: {
    type: 'FeatureCollection', features: [
      /* Poles d'emploi (C12) */
      { type:'Feature', properties:{ nom:'Belfort — 23 500 emplois salaries (C12)', cat:'Emplois C12', type:'pole_emploi' },
        geometry:{ type:'Point', coordinates:[6.863, 47.637] }},
      { type:'Feature', properties:{ nom:'Trevenans — 3 178 emplois (C12)', cat:'Emplois C12', type:'pole_emploi' },
        geometry:{ type:'Point', coordinates:[6.907, 47.610] }},
      { type:'Feature', properties:{ nom:'Delle — 2 080 emplois (C12)', cat:'Emplois C12', type:'pole_emploi' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
      /* Communes ACV/PVD — Accompagnement ANCT (C15) */
      { type:'Feature', properties:{ nom:'Belfort — Action Coeur de Ville (C15)', cat:'ANCT C15', type:'ACV' },
        geometry:{ type:'Point', coordinates:[6.863, 47.637] }},
      { type:'Feature', properties:{ nom:'Delle — Petites Villes de Demain (C15)', cat:'ANCT C15', type:'PVD' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
      { type:'Feature', properties:{ nom:'Giromagny — Petites Villes de Demain (C15)', cat:'ANCT C15', type:'PVD' },
        geometry:{ type:'Point', coordinates:[6.831, 47.743] }},
      /* Fonds vert (C14) */
      { type:'Feature', properties:{ nom:'Projets Fonds vert (100 operations, 9M€ depuis 2023 — C14)', cat:'Fonds vert C14', type:'fonds_vert' },
        geometry:{ type:'Point', coordinates:[6.860, 47.640] }},
    ]
  },

  /* ── 3. NOUVELLES ENERGIES ET CHANGEMENT CLIMATIQUE (C16–C26) ────
     ENR : PV toiture, PV parking, eolien, hydrogene, biomasse       */
  energie: {
    type: 'FeatureCollection', features: [
      /* Photovoltaique existant (C21) */
      { type:'Feature', properties:{ nom:'Parc PV au sol — Sevenans (C21)', cat:'PV existant C21', type:'pv_sol' },
        geometry:{ type:'Point', coordinates:[6.903, 47.658] }},
      { type:'Feature', properties:{ nom:'Toitures PV — Zone industrielle Belfort (C21)', cat:'PV existant C21', type:'pv_toiture' },
        geometry:{ type:'Point', coordinates:[6.891, 47.648] }},
      /* Potentiel PV parkings > 1500 m2 (C23 — loi APER) */
      { type:'Feature', properties:{ nom:'Parking Intermarche Belfort (C23 — loi APER)', cat:'PV parking C23', type:'parking_pv' },
        geometry:{ type:'Point', coordinates:[6.855, 47.632] }},
      { type:'Feature', properties:{ nom:'Parking CHU Trevenans (C23 — loi APER)', cat:'PV parking C23', type:'parking_pv' },
        geometry:{ type:'Point', coordinates:[6.907, 47.610] }},
      { type:'Feature', properties:{ nom:'Parking Gare Belfort-Montbeliard TGV (C23)', cat:'PV parking C23', type:'parking_pv' },
        geometry:{ type:'Point', coordinates:[6.912, 47.609] }},
      /* Potentiel éolien (C24) — pas d'éolienne dans le 90, zones d'etude */
      { type:'Feature', properties:{ nom:'Zone d\'etude eolienne Vosges du Sud (C24)', cat:'Potentiel eolien C24', type:'eolien_etude' },
        geometry:{ type:'Polygon', coordinates:[[[6.65,47.73],[6.78,47.73],[6.78,47.82],[6.65,47.82],[6.65,47.73]]] }},
      /* Filière hydrogène (C25) */
      { type:'Feature', properties:{ nom:'Filiere hydrogene — GBCA (C25)', cat:'Hydrogene C25', type:'hydrogene' },
        geometry:{ type:'Point', coordinates:[6.870, 47.640] }},
      /* Energies biosourcées / chaufferies bois (C20) */
      { type:'Feature', properties:{ nom:'Chaufferie bois collectif Belfort (C20)', cat:'Biomasse C20', type:'biomasse' },
        geometry:{ type:'Point', coordinates:[6.852, 47.641] }},
      { type:'Feature', properties:{ nom:'Reseau chaleur urbain Belfort (C20)', cat:'Reseau chaleur C20', type:'reseau_chaleur' },
        geometry:{ type:'LineString', coordinates:[[6.840,47.635],[6.860,47.637],[6.875,47.643]] }},
      /* Recharge vehicules electriques (C26) */
      { type:'Feature', properties:{ nom:'Borne recharge VE — Gare Belfort (C26)', cat:'Mobilite electrique C26', type:'borne_ve' },
        geometry:{ type:'Point', coordinates:[6.860, 47.640] }},
    ]
  },

  /* ── 4. AGRICULTURE (C27–C40) ────────────────────────────────────
     SAU, PAC, labels, circuits courts, nitrates, agroecologie       */
  agriculture: {
    type: 'FeatureCollection', features: [
      /* Petites régions agricoles (C28) */
      { type:'Feature', properties:{ nom:'Region agricole Sundgau (C28 — polyculture-elevage)', cat:'Regions agricoles C28', type:'region_agri' },
        geometry:{ type:'Polygon', coordinates:[[[6.88,47.50],[7.08,47.50],[7.08,47.64],[6.88,47.64],[6.88,47.50]]] }},
      { type:'Feature', properties:{ nom:'Region agricole Vosges du Sud (C28 — elevage bovin)', cat:'Regions agricoles C28', type:'region_agri' },
        geometry:{ type:'Polygon', coordinates:[[[6.65,47.69],[6.84,47.69],[6.84,47.87],[6.65,47.87],[6.65,47.69]]] }},
      { type:'Feature', properties:{ nom:'Region agricole Plaine de Belfort (C28 — grandes cultures)', cat:'Regions agricoles C28', type:'region_agri' },
        geometry:{ type:'Polygon', coordinates:[[[6.75,47.60],[6.88,47.60],[6.88,47.70],[6.75,47.70],[6.75,47.60]]] }},
      /* SIQO — Labels qualité (C30) */
      { type:'Feature', properties:{ nom:'Fromage Comte AOP (C30 — SIQO)', cat:'Labels qualite C30', type:'siqo_aop' },
        geometry:{ type:'Point', coordinates:[6.850, 47.720] }},
      { type:'Feature', properties:{ nom:'Volaille de Bresse AOP (C30 — SIQO)', cat:'Labels qualite C30', type:'siqo_aop' },
        geometry:{ type:'Point', coordinates:[6.980, 47.520] }},
      /* Agriculture biologique (C36) */
      { type:'Feature', properties:{ nom:'Exploitations AB certifiees — secteur Giromagny (C36)', cat:'Agriculture bio C36', type:'bio' },
        geometry:{ type:'Point', coordinates:[6.831, 47.743] }},
      /* Circuits courts (C38-C39) */
      { type:'Feature', properties:{ nom:'Magasin de producteurs — La Ferme du 90 (C39)', cat:'Circuits courts C39', type:'circuit_court' },
        geometry:{ type:'Point', coordinates:[6.892, 47.648] }},
      { type:'Feature', properties:{ nom:'AMAP Belfort centre (C39)', cat:'Circuits courts C39', type:'circuit_court' },
        geometry:{ type:'Point', coordinates:[6.856, 47.638] }},
      { type:'Feature', properties:{ nom:'Marche de producteurs Delle (C39)', cat:'Circuits courts C39', type:'circuit_court' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
      /* Zones vulnérables nitrates (C40) */
      { type:'Feature', properties:{ nom:'Zone vulnerable nitrates — Bassin de l\'Allan (C40)', cat:'Nitrates C40', type:'nitrates' },
        geometry:{ type:'Polygon', coordinates:[[[6.84,47.50],[7.05,47.50],[7.05,47.64],[6.84,47.64],[6.84,47.50]]] }},
      { type:'Feature', properties:{ nom:'Zone vulnerable nitrates — Vallee Bourbeuse (C40)', cat:'Nitrates C40', type:'nitrates' },
        geometry:{ type:'Polygon', coordinates:[[[6.70,47.60],[6.86,47.60],[6.86,47.66],[6.70,47.66],[6.70,47.60]]] }},
      /* Agroécologie — Collectifs (C37) */
      { type:'Feature', properties:{ nom:'Collectif agroecologique CCST — L\'Eau d\'Ici (C37)', cat:'Agroecologie C37', type:'agroecologie' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
    ]
  },

  /* ── 5. EAU (C41–C49) ────────────────────────────────────────────
     Cours d'eau, SAGE, masses d'eau, zones humides, assainissement  */
  eau: {
    type: 'FeatureCollection', features: [
      /* Cours d'eau principaux (C41) */
      { type:'Feature', properties:{ nom:'La Savoureuse — troncon vosgien (C41)', cat:'Cours d\'eau C41', type:'cours_eau' },
        geometry:{ type:'LineString', coordinates:[[6.825,47.845],[6.840,47.750],[6.858,47.700],[6.860,47.637],[6.875,47.560]] }},
      { type:'Feature', properties:{ nom:'La Bourbeuse (C41)', cat:'Cours d\'eau C41', type:'cours_eau' },
        geometry:{ type:'LineString', coordinates:[[6.668,47.654],[6.730,47.648],[6.810,47.643],[6.865,47.638],[6.940,47.625]] }},
      { type:'Feature', properties:{ nom:'L\'Allaine (C41)', cat:'Cours d\'eau C41', type:'cours_eau' },
        geometry:{ type:'LineString', coordinates:[[6.920,47.540],[6.930,47.490],[6.950,47.460],[6.970,47.440]] }},
      { type:'Feature', properties:{ nom:'La Lizaine (C41)', cat:'Cours d\'eau C41', type:'cours_eau' },
        geometry:{ type:'LineString', coordinates:[[6.750,47.504],[6.820,47.530],[6.900,47.545],[6.960,47.555]] }},
      { type:'Feature', properties:{ nom:'La Douce / Allan aval (C41)', cat:'Cours d\'eau C41', type:'cours_eau' },
        geometry:{ type:'LineString', coordinates:[[6.990,47.480],[6.960,47.510],[6.935,47.540]] }},
      /* SAGE Allan (C43) */
      { type:'Feature', properties:{ nom:'Perimetre SAGE Allan (C43)', cat:'SAGE C43', type:'sage' },
        geometry:{ type:'Polygon', coordinates:[[[6.65,47.44],[7.12,47.44],[7.12,47.87],[6.65,47.87],[6.65,47.44]]] }},
      /* Zones humides (C46) */
      { type:'Feature', properties:{ nom:'Zones humides — fond de vallee Savoureuse (C46)', cat:'Zones humides C46', type:'zone_humide' },
        geometry:{ type:'Polygon', coordinates:[[[6.845,47.600],[6.875,47.600],[6.875,47.680],[6.845,47.680],[6.845,47.600]]] }},
      { type:'Feature', properties:{ nom:'Zones humides — vallee Bourbeuse (C46)', cat:'Zones humides C46', type:'zone_humide' },
        geometry:{ type:'Polygon', coordinates:[[[6.750,47.620],[6.880,47.620],[6.880,47.655],[6.750,47.655],[6.750,47.620]]] }},
      { type:'Feature', properties:{ nom:'Etangs du Sundgau > 2600 plans d\'eau (C47)', cat:'Plans d\'eau C47', type:'plan_eau' },
        geometry:{ type:'Polygon', coordinates:[[[6.90,47.48],[7.05,47.48],[7.05,47.55],[6.90,47.55],[6.90,47.48]]] }},
      /* Stations d'épuration (C49) */
      { type:'Feature', properties:{ nom:'STEU Belfort (C49)', cat:'Assainissement C49', type:'step' },
        geometry:{ type:'Point', coordinates:[6.878, 47.620] }},
      { type:'Feature', properties:{ nom:'STEU Delle (C49)', cat:'Assainissement C49', type:'step' },
        geometry:{ type:'Point', coordinates:[6.995, 47.500] }},
      { type:'Feature', properties:{ nom:'STEU Delle-Lebetain (C49)', cat:'Assainissement C49', type:'step' },
        geometry:{ type:'Point', coordinates:[7.005, 47.495] }},
      /* Captages AEP (C48) */
      { type:'Feature', properties:{ nom:'Captage AEP Savoureuse — Belfort (C48)', cat:'Prelevements eau C48', type:'captage_aep' },
        geometry:{ type:'Point', coordinates:[6.860, 47.660] }},
      { type:'Feature', properties:{ nom:'Captage AEP Allaine — Sud Territoire (C48)', cat:'Prelevements eau C48', type:'captage_aep' },
        geometry:{ type:'Point', coordinates:[6.948, 47.476] }},
    ]
  },

  /* ── 6. BIODIVERSITE ET FORET (C50–C58) ─────────────────────────
     TVB, reserves naturelles, Natura 2000, ZNIEFF, forets           */
  biodiversite: {
    type: 'FeatureCollection', features: [
      /* Trame verte — réservoirs (C50) */
      { type:'Feature', properties:{ nom:'Massif vosgien — reservoir biodiversite (C50)', cat:'Trame verte C50', type:'reservoir' },
        geometry:{ type:'Polygon', coordinates:[[[6.648,47.718],[6.820,47.718],[6.820,47.870],[6.648,47.870],[6.648,47.718]]] }},
      { type:'Feature', properties:{ nom:'Massif du Jura — reservoir biodiversite (C50)', cat:'Trame verte C50', type:'reservoir' },
        geometry:{ type:'Polygon', coordinates:[[[6.850,47.440],[7.100,47.440],[7.100,47.550],[6.850,47.550],[6.850,47.440]]] }},
      /* Trame bleue — corridors (C51) */
      { type:'Feature', properties:{ nom:'Ripisylve Savoureuse — corridor bleu (C51)', cat:'Trame bleue C51', type:'corridor_bleu' },
        geometry:{ type:'LineString', coordinates:[[6.825,47.845],[6.845,47.750],[6.858,47.700],[6.860,47.637],[6.875,47.560]] }},
      { type:'Feature', properties:{ nom:'Ripisylve Bourbeuse — corridor bleu (C51)', cat:'Trame bleue C51', type:'corridor_bleu' },
        geometry:{ type:'LineString', coordinates:[[6.668,47.654],[6.730,47.648],[6.810,47.643],[6.865,47.638]] }},
      /* Protection patrimoine naturel (C52) */
      { type:'Feature', properties:{ nom:'Reserve naturelle nationale — Ballons des Vosges (C52)', cat:'Protection C52', type:'reserve' },
        geometry:{ type:'Point', coordinates:[6.837, 47.821] }},
      { type:'Feature', properties:{ nom:'Zone Natura 2000 — Vosges du Sud (C52)', cat:'Natura 2000 C52', type:'natura2000' },
        geometry:{ type:'Polygon', coordinates:[[[6.648,47.700],[6.820,47.700],[6.820,47.870],[6.648,47.870],[6.648,47.700]]] }},
      /* ZNIEFF (C53) */
      { type:'Feature', properties:{ nom:'ZNIEFF type I — Tourbieres des Hautes-Vosges (C53)', cat:'ZNIEFF C53', type:'znieff1' },
        geometry:{ type:'Point', coordinates:[6.780, 47.810] }},
      { type:'Feature', properties:{ nom:'ZNIEFF type II — Forets vosgiennes (C53)', cat:'ZNIEFF C53', type:'znieff2' },
        geometry:{ type:'Polygon', coordinates:[[[6.648,47.690],[6.820,47.690],[6.820,47.870],[6.648,47.870],[6.648,47.690]]] }},
      /* Forêts — couverture 43% du territoire (C57) */
      { type:'Feature', properties:{ nom:'Foret communale de Giromagny (C57 — 43% du 90 boise)', cat:'Forets C57', type:'foret' },
        geometry:{ type:'Polygon', coordinates:[[[6.775,47.730],[6.845,47.730],[6.845,47.775],[6.775,47.775],[6.775,47.730]]] }},
      { type:'Feature', properties:{ nom:'Foret de Rougegoutte (C57)', cat:'Forets C57', type:'foret' },
        geometry:{ type:'Polygon', coordinates:[[[6.720,47.690],[6.780,47.690],[6.780,47.720],[6.720,47.720],[6.720,47.690]]] }},
      { type:'Feature', properties:{ nom:'Foret de la Douce — massif jurassien (C57)', cat:'Forets C57', type:'foret' },
        geometry:{ type:'Polygon', coordinates:[[[6.950,47.450],[7.050,47.450],[7.050,47.510],[6.950,47.510],[6.950,47.450]]] }},
      /* Ballon d'Alsace — OGS (C58-C89) */
      { type:'Feature', properties:{ nom:'Ballon d\'Alsace 1247 m — Operation Grand Site (C57/C89)', cat:'Grand Site C89', type:'grand_site' },
        geometry:{ type:'Point', coordinates:[6.837, 47.821] }},
    ]
  },

  /* ── 7. RISQUES NATURELS (C56–C64) ──────────────────────────────
     Inondation PPRi, sismicite, mouvements terrain, radon, feux     */
  risques: {
    type: 'FeatureCollection', features: [
      /* PPRi — zones inondables (C57–C58) */
      { type:'Feature', properties:{ nom:'PPRi Savoureuse — zone inondable (C58)', cat:'PPRi C58', type:'ppri' },
        geometry:{ type:'Polygon', coordinates:[[[6.840,47.590],[6.888,47.590],[6.888,47.720],[6.840,47.720],[6.840,47.590]]] }},
      { type:'Feature', properties:{ nom:'PPRi Bourbeuse — zone inondable (C58)', cat:'PPRi C58', type:'ppri' },
        geometry:{ type:'Polygon', coordinates:[[[6.700,47.618],[6.890,47.618],[6.890,47.658],[6.700,47.658],[6.700,47.618]]] }},
      { type:'Feature', properties:{ nom:'PPRi Allaine — zone inondable (C58)', cat:'PPRi C58', type:'ppri' },
        geometry:{ type:'Polygon', coordinates:[[[6.900,47.500],[6.980,47.500],[6.980,47.555],[6.900,47.555],[6.900,47.500]]] }},
      /* AZI (C58) */
      { type:'Feature', properties:{ nom:'AZI Bourbeuse — Atlas Zones Inondables (C58)', cat:'AZI C58', type:'azi' },
        geometry:{ type:'Polygon', coordinates:[[[6.700,47.615],[6.890,47.615],[6.890,47.655],[6.700,47.655],[6.700,47.615]]] }},
      /* Zones sismiques (C59) */
      { type:'Feature', properties:{ nom:'Zone sismicite 3 (moderee) — Massif vosgien (C59)', cat:'Sismicite C59', type:'sismique_3' },
        geometry:{ type:'Polygon', coordinates:[[[6.650,47.700],[6.830,47.700],[6.830,47.870],[6.650,47.870],[6.650,47.700]]] }},
      { type:'Feature', properties:{ nom:'Zone sismicite 2 (faible) — Plaine et Jura (C59)', cat:'Sismicite C59', type:'sismique_2' },
        geometry:{ type:'Polygon', coordinates:[[[6.840,47.440],[7.120,47.440],[7.120,47.700],[6.840,47.700],[6.840,47.440]]] }},
      /* Mouvements de terrain (C60) */
      { type:'Feature', properties:{ nom:'Alea mouvements terrain — versants vosgiens (C60)', cat:'Mouvements terrain C60', type:'mvt_terrain' },
        geometry:{ type:'Polygon', coordinates:[[[6.655,47.680],[6.820,47.680],[6.820,47.870],[6.655,47.870],[6.655,47.680]]] }},
      /* Retrait-gonflement argiles (C61) */
      { type:'Feature', properties:{ nom:'Zone argiles — alea moyen (C61)', cat:'Argiles C61', type:'argiles_moyen' },
        geometry:{ type:'Polygon', coordinates:[[[6.780,47.560],[6.960,47.560],[6.960,47.660],[6.780,47.660],[6.780,47.560]]] }},
      /* Risque minier (C62) */
      { type:'Feature', properties:{ nom:'Ancienne mine de Giromagny (C62)', cat:'Risque minier C62', type:'minier' },
        geometry:{ type:'Point', coordinates:[6.831, 47.743] }},
      { type:'Feature', properties:{ nom:'Zone de vigilance miniere Masevaux (C62)', cat:'Risque minier C62', type:'minier' },
        geometry:{ type:'Polygon', coordinates:[[[6.790,47.735],[6.830,47.735],[6.830,47.760],[6.790,47.760],[6.790,47.735]]] }},
      /* Feux de forêt (C63) */
      { type:'Feature', properties:{ nom:'Zone alea feux de foret — Vosges (C63)', cat:'Feux foret C63', type:'feux_foret' },
        geometry:{ type:'Polygon', coordinates:[[[6.648,47.700],[6.820,47.700],[6.820,47.870],[6.648,47.870],[6.648,47.700]]] }},
      /* Radon (C64) */
      { type:'Feature', properties:{ nom:'Zone a potentiel radon eleve — granite vosgien (C64)', cat:'Radon C64', type:'radon' },
        geometry:{ type:'Polygon', coordinates:[[[6.648,47.700],[6.820,47.700],[6.820,47.870],[6.648,47.870],[6.648,47.700]]] }},
    ]
  },

  /* ── 8. URBANISME ET AMENAGEMENT DURABLE (C65–C71) ──────────────
     PLU, SCoT, sobriete fonciere, friches                           */
  urbanisme: {
    type: 'FeatureCollection', features: [
      /* Communes par type de document (C65) */
      { type:'Feature', properties:{ nom:'Communes sous PLU (53/101) — exemple Belfort (C65)', cat:'Documents urbanisme C65', type:'PLU' },
        geometry:{ type:'Point', coordinates:[6.863, 47.637] }},
      { type:'Feature', properties:{ nom:'Commune sous RNU (31/101) — sans document oppose (C65)', cat:'Documents urbanisme C65', type:'RNU' },
        geometry:{ type:'Point', coordinates:[6.750, 47.780] }},
      { type:'Feature', properties:{ nom:'PLUi CCVS en cours d\'elaboration (22 communes) (C66)', cat:'Procedures C66', type:'PLUi' },
        geometry:{ type:'Point', coordinates:[6.831, 47.743] }},
      /* SCoT */
      { type:'Feature', properties:{ nom:'Perimetre SCoT du Territoire de Belfort (approuve 2014, en revision)', cat:'SCoT', type:'scot' },
        geometry:{ type:'Polygon', coordinates:[[[6.648,47.440],[7.120,47.440],[7.120,47.870],[6.648,47.870],[6.648,47.440]]] }},
      /* Sobriété foncière — zones AU (C69) */
      { type:'Feature', properties:{ nom:'Zone d\'urbanisation future AU — Cravanche (C69)', cat:'Zones AU C69', type:'zone_AU' },
        geometry:{ type:'Polygon', coordinates:[[[6.823,47.618],[6.862,47.618],[6.862,47.638],[6.823,47.638],[6.823,47.618]]] }},
      { type:'Feature', properties:{ nom:'Zone d\'extension ZAE — Sevenans (C69)', cat:'Zones AU C69', type:'zone_AUx' },
        geometry:{ type:'Polygon', coordinates:[[[6.870,47.647],[6.935,47.647],[6.935,47.672],[6.870,47.672],[6.870,47.647]]] }},
      /* Friches (C70–C71) */
      { type:'Feature', properties:{ nom:'Friche industrielle Alsthom — Belfort (C71)', cat:'Friches C71', type:'friche' },
        geometry:{ type:'Point', coordinates:[6.880, 47.630] }},
      { type:'Feature', properties:{ nom:'Friche industrielle ACB — Beaucourt (C71)', cat:'Friches C71', type:'friche' },
        geometry:{ type:'Point', coordinates:[6.921, 47.491] }},
      { type:'Feature', properties:{ nom:'Friche commerciale Delle (C71)', cat:'Friches C71', type:'friche' },
        geometry:{ type:'Point', coordinates:[6.990, 47.504] }},
    ]
  },

  /* ── 9. HABITAT ET LOGEMENT (C72–C81) ───────────────────────────
     Precarite energetique, logements sociaux, QPV, gens du voyage   */
  habitat: {
    type: 'FeatureCollection', features: [
      /* Logements sociaux > 30% (C78–C79) */
      { type:'Feature', properties:{ nom:'Parc social Belfort — 41% logements sociaux (C78)', cat:'Logements sociaux C78', type:'HLM' },
        geometry:{ type:'Point', coordinates:[6.863, 47.637] }},
      { type:'Feature', properties:{ nom:'Parc social Beaucourt — 36,7% (C78)', cat:'Logements sociaux C78', type:'HLM' },
        geometry:{ type:'Point', coordinates:[6.921, 47.491] }},
      { type:'Feature', properties:{ nom:'Parc social Delle — 36,7% (C78)', cat:'Logements sociaux C78', type:'HLM' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
      /* Quartiers prioritaires de la ville (C80) */
      { type:'Feature', properties:{ nom:'QPV Residence Europe — Belfort (C80)', cat:'QPV C80', type:'qpv' },
        geometry:{ type:'Polygon', coordinates:[[[6.840,47.627],[6.862,47.627],[6.862,47.643],[6.840,47.643],[6.840,47.627]]] }},
      { type:'Feature', properties:{ nom:'QPV Les Residences — Offemont (C80)', cat:'QPV C80', type:'qpv' },
        geometry:{ type:'Polygon', coordinates:[[[6.810,47.655],[6.835,47.655],[6.835,47.668],[6.810,47.668],[6.810,47.655]]] }},
      { type:'Feature', properties:{ nom:'QPV Cul-de-Sac / La Ruche — Bavilliers (C80)', cat:'QPV C80', type:'qpv' },
        geometry:{ type:'Polygon', coordinates:[[[6.865,47.612],[6.880,47.612],[6.880,47.620],[6.865,47.620],[6.865,47.612]]] }},
      { type:'Feature', properties:{ nom:'QPV Vieux-Beau / Tivoli — Valdoie (C80)', cat:'QPV C80', type:'qpv' },
        geometry:{ type:'Polygon', coordinates:[[[6.828,47.656],[6.842,47.656],[6.842,47.664],[6.828,47.664],[6.828,47.656]]] }},
      /* Aires d'accueil gens du voyage (C81) */
      { type:'Feature', properties:{ nom:'Aire accueil gens du voyage — Belfort (C81)', cat:'Gens du voyage C81', type:'aire_gdv' },
        geometry:{ type:'Point', coordinates:[6.848, 47.648] }},
      { type:'Feature', properties:{ nom:'Aire accueil gens du voyage — Delle (C81)', cat:'Gens du voyage C81', type:'aire_gdv' },
        geometry:{ type:'Point', coordinates:[6.988, 47.505] }},
      { type:'Feature', properties:{ nom:'Aire de grand passage — Fontaine (C81)', cat:'Gens du voyage C81', type:'aire_gdv' },
        geometry:{ type:'Point', coordinates:[6.895, 47.628] }},
      /* Equipements santé */
      { type:'Feature', properties:{ nom:'CHBM — Centre Hospitalier Belfort-Montbeliard', cat:'Sante', type:'hopital' },
        geometry:{ type:'Point', coordinates:[6.863, 47.637] }},
      { type:'Feature', properties:{ nom:'Hopital de Delle', cat:'Sante', type:'hopital' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
    ]
  },

  /* ── 10. MOBILITES, TRANSPORTS ET SECURITE ROUTIERE (C82–C87) ───
     Flux vehicules, cyclable, bruit, radars, accidents              */
  mobilite: {
    type: 'FeatureCollection', features: [
      /* Axes à fort trafic > 20 000 veh/j (C82) */
      { type:'Feature', properties:{ nom:'A36 Belfort-Montbeliard >40 000 veh/j (C82)', cat:'Flux vehicules C82', type:'trafic_fort' },
        geometry:{ type:'LineString', coordinates:[[6.860,47.637],[6.910,47.609],[6.960,47.592]] }},
      { type:'Feature', properties:{ nom:'A36 Belfort-Mulhouse >20 000 veh/j (C82)', cat:'Flux vehicules C82', type:'trafic_fort' },
        geometry:{ type:'LineString', coordinates:[[7.000,47.658],[7.040,47.670],[7.090,47.675]] }},
      { type:'Feature', properties:{ nom:'RN19 acces Belfort >20 000 veh/j (C82)', cat:'Flux vehicules C82', type:'trafic_fort' },
        geometry:{ type:'LineString', coordinates:[[6.860,47.637],[6.860,47.680],[6.860,47.720]] }},
      /* Aménagements cyclables (C83) */
      { type:'Feature', properties:{ nom:'Coulee verte Belfort-Montbeliard (C83)', cat:'Cyclable C83', type:'voie_verte' },
        geometry:{ type:'LineString', coordinates:[[6.860,47.637],[6.895,47.617],[6.912,47.609]] }},
      { type:'Feature', properties:{ nom:'Piste cyclable departementale D83 (C83)', cat:'Cyclable C83', type:'piste_velo' },
        geometry:{ type:'LineString', coordinates:[[6.860,47.637],[6.870,47.710],[6.835,47.743]] }},
      { type:'Feature', properties:{ nom:'Reseau cyclable Grand Belfort >75 km (C83)', cat:'Cyclable C83', type:'reseau_velo' },
        geometry:{ type:'Point', coordinates:[6.860, 47.637] }},
      /* Radars (C86) — 28 radars fixes */
      { type:'Feature', properties:{ nom:'Radar fixe A36 PK12 (C86 — 28 radars dans le 90)', cat:'Radars C86', type:'radar' },
        geometry:{ type:'Point', coordinates:[6.900, 47.620] }},
      { type:'Feature', properties:{ nom:'Radar fixe RN19 Belfort Nord (C86)', cat:'Radars C86', type:'radar' },
        geometry:{ type:'Point', coordinates:[6.860, 47.690] }},
      { type:'Feature', properties:{ nom:'Radar fixe Delle acces suisse (C86)', cat:'Radars C86', type:'radar' },
        geometry:{ type:'Point', coordinates:[6.990, 47.495] }},
      /* Zones accidentogènes (C87) */
      { type:'Feature', properties:{ nom:'Point noir accident — echangeur A36/RN19 (C87 — 129 accidents 2021-23)', cat:'Accidents C87', type:'accident' },
        geometry:{ type:'Point', coordinates:[6.860, 47.637] }},
      { type:'Feature', properties:{ nom:'Point noir accident — Delle acces RN19 (C87)', cat:'Accidents C87', type:'accident' },
        geometry:{ type:'Point', coordinates:[6.993, 47.504] }},
      /* Bruit (C84-C85) */
      { type:'Feature', properties:{ nom:'Secteur affecte bruit cat.1 A36 (C84-C85)', cat:'Bruit C84', type:'bruit_1' },
        geometry:{ type:'Polygon', coordinates:[[[6.840,47.605],[6.960,47.605],[6.960,47.668],[6.840,47.668],[6.840,47.605]]] }},
    ]
  },

  /* ── 11. PATRIMOINE ET AUTRES THEMATIQUES (C88–C91) ─────────────
     Monuments historiques, archeologie, moustique tigre             */
  patrimoine: {
    type: 'FeatureCollection', features: [
      /* Monuments historiques classés (C88) */
      { type:'Feature', properties:{ nom:'Citadelle Vauban de Belfort — Classe MH (C88)', cat:'Monuments MH C88', type:'MH_classe' },
        geometry:{ type:'Point', coordinates:[6.865, 47.638] }},
      { type:'Feature', properties:{ nom:'Lion de Belfort — Bartholdi — Classe MH (C88)', cat:'Monuments MH C88', type:'MH_classe' },
        geometry:{ type:'Point', coordinates:[6.862, 47.636] }},
      { type:'Feature', properties:{ nom:'Temple Saint-Christophe Belfort — Inscrit MH (C88)', cat:'Monuments MH C88', type:'MH_inscrit' },
        geometry:{ type:'Point', coordinates:[6.860, 47.638] }},
      { type:'Feature', properties:{ nom:'Eglise Saint-Georges Rougegoutte — Inscrit MH (C88)', cat:'Monuments MH C88', type:'MH_inscrit' },
        geometry:{ type:'Point', coordinates:[6.720, 47.710] }},
      { type:'Feature', properties:{ nom:'Chateau du Rosemont — Inscrit MH (C88)', cat:'Monuments MH C88', type:'MH_inscrit' },
        geometry:{ type:'Point', coordinates:[6.850, 47.730] }},
      { type:'Feature', properties:{ nom:'Perimetre de protection MH Belfort 500m (C88)', cat:'Abords MH C88', type:'perimetre_MH' },
        geometry:{ type:'Polygon', coordinates:[[[6.820,47.608],[6.905,47.608],[6.905,47.668],[6.820,47.668],[6.820,47.608]]] }},
      /* Sites archéologiques (C90) */
      { type:'Feature', properties:{ nom:'ZPPA Belfort centre — zone archeologique (C90)', cat:'Archeologie C90', type:'zppa' },
        geometry:{ type:'Polygon', coordinates:[[[6.845,47.625],[6.885,47.625],[6.885,47.650],[6.845,47.650],[6.845,47.625]]] }},
      { type:'Feature', properties:{ nom:'Vestige romain — voie romaine Mandeure (C90)', cat:'Archeologie C90', type:'site_archeo' },
        geometry:{ type:'Point', coordinates:[6.950, 47.480] }},
      /* Site Grand Site Ballon d'Alsace (C89) */
      { type:'Feature', properties:{ nom:'Operation Grand Site Ballon d\'Alsace (C89)', cat:'Grand Site C89', type:'grand_site' },
        geometry:{ type:'Polygon', coordinates:[[[6.700,47.770],[6.860,47.770],[6.860,47.870],[6.700,47.870],[6.700,47.770]]] }},
      /* Risques sanitaires — moustique tigre (C91) */
      { type:'Feature', properties:{ nom:'Zone surveillance moustique tigre — Nord Franche-Comte (C91)', cat:'Sanitaire C91', type:'moustique' },
        geometry:{ type:'Polygon', coordinates:[[[6.648,47.580],[7.120,47.580],[7.120,47.680],[6.648,47.680],[6.648,47.580]]] }},
    ]
  },

};

/* ── État global de l'application ───────────────────────────────── */
var A = {
  /* Projet */
  typeProjet:    null,    // id du type sélectionné
  taille:        1,       // 1-4
  themesActifs:  null,    // Set des thèmes filtrés
  superficieHa:  null,    // superficie en hectares
  /* Carte — placement */
  modePlacement: false,   // mode clic-pour-placer actif
  modeDeplace:   false,   // mode double-clic-pour-déplacer actif
  carte:         null,    // instance L.map
  layerCommunes: null,    // GeoJSON communes
  layerProjet:   null,    // CircleMarker projet
  layerCercle:   null,    // Circle superficie
  position:      null,    // { lat, lng }
  /* Couches thématiques */
  couches:       {},      // { themeId: L.GeoJSON }
  couchesActives: new Set(), // thèmes actuellement affichés
};

/* ── Point d'entrée ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  A.themesActifs = new Set(THEMES.map(function(t){ return t.id; }));
  initCarte();
  genBoutons();
  genBadgesThemes();
  genControleCouches();
  majTaille(1);
});

/* ════════════════════════════════════════════════════════════════════
   CARTE LEAFLET
   ════════════════════════════════════════════════════════════════════ */

function initCarte() {
  A.carte = L.map('map', {
    center: [47.637, 6.863],
    zoom: 11,
    doubleClickZoom: false,   // désactivé pour ne pas interférer avec le déplacement
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(A.carte);

  ajouterCommunesGeoJSON();
  ajouterMarqueursPrincipaux();
  ajouterListenersGlobaux();
}

/* Charge le GeoJSON des communes avec tooltips et highlight */
function ajouterCommunesGeoJSON() {
  A.layerCommunes = L.geoJSON(GEOJSON_TB, {
    style: styleCommuneDefaut,
    onEachFeature: function(feature, layer) {
      /* Tooltip hover */
      var p   = feature.properties;
      var sup = p.superficie_ha || 0;
      var supAff = sup >= 100
        ? (sup / 100).toFixed(1) + ' km² (' + sup.toFixed(0) + ' ha)'
        : sup.toFixed(1) + ' ha';
      var pop = p.population
        ? p.population.toLocaleString('fr-FR') + ' hab.'
        : 'N/A';

      layer.bindTooltip(
        '<div class="tt-nom">' + p.nom + '</div>' +
        '<div class="tt-row"><span class="tt-ico">&#x1F465;</span><span>Population&nbsp;: </span><span class="tt-val">' + pop + '</span></div>' +
        '<div class="tt-row"><span class="tt-ico">&#x1F4CF;</span><span>Superficie&nbsp;: </span><span class="tt-val">' + supAff + '</span></div>' +
        '<div class="tt-row"><span class="tt-ico">&#x1F4EE;</span><span>Code postal&nbsp;: </span><span class="tt-val">' + (p.codesPostaux ? p.codesPostaux[0] : '') + '</span></div>',
        { className: 'commune-tooltip', sticky: true, direction: 'top', offset: [0, -4] }
      );

      layer.on('mouseover', function() {
        if (!A.modePlacement && !A.modeDeplace) {
          layer.setStyle({ fillOpacity: 0.20, weight: 2, color: '#002395' });
        }
      });
      layer.on('mouseout', function() {
        A.layerCommunes.resetStyle(layer);
      });

      /* Clic simple → placement si mode actif */
      layer.on('click', function(e) {
        gererClicCarte(e.latlng.lat, e.latlng.lng);
      });

      /* Double-clic → déplacement du projet existant */
      layer.on('dblclick', function(e) {
        L.DomEvent.stopPropagation(e);
        gererDblClicCarte(e.latlng.lat, e.latlng.lng);
      });
    }
  }).addTo(A.carte);
}

function styleCommuneDefaut() {
  return { color: '#002395', weight: 1, opacity: 0.45, fillColor: '#002395', fillOpacity: 0.04 };
}

function ajouterMarqueursPrincipaux() {
  /* Marqueur discret pour le chef-lieu uniquement — sans markers de villes */
  ajouterMarqueur(47.637, 6.863, '#002395', 7, '<b>Belfort</b><br/>Chef-lieu &mdash; DDT 90');
}

function ajouterMarqueur(lat, lng, fill, r, popup) {
  L.circleMarker([lat, lng], {
    radius: r, fillColor: fill, color: '#fff', weight: 2, fillOpacity: .95,
  }).addTo(A.carte).bindPopup(popup);
}

/* Listeners globaux sur la carte (zones vides entre communes) */
function ajouterListenersGlobaux() {
  A.carte.on('click', function(e) {
    gererClicCarte(e.latlng.lat, e.latlng.lng);
  });
  A.carte.on('dblclick', function(e) {
    gererDblClicCarte(e.latlng.lat, e.latlng.lng);
  });
}

/* ════════════════════════════════════════════════════════════════════
   GESTION DES CLICS / DOUBLE-CLICS SUR LA CARTE
   ════════════════════════════════════════════════════════════════════ */

/* Clic simple : place le projet si mode placement actif */
function gererClicCarte(lat, lng) {
  if (A.modePlacement) {
    placerProjet(lat, lng);
    desactiverPlacement();
  }
}

/* Double-clic : sélectionne & active le mode déplacement si le projet existe,
   ou sinon déplace directement si modeDeplace déjà actif */
function gererDblClicCarte(lat, lng) {
  if (!A.position) return;   // aucun projet placé

  if (A.modeDeplace) {
    /* Deuxième double-clic : déplacer à ce point */
    placerProjet(lat, lng);
    desactiverDeplace();
  } else {
    /* Premier double-clic : activer le mode déplacement */
    activerDeplace();
  }
}

/* ════════════════════════════════════════════════════════════════════
   PLACEMENT ET DÉPLACEMENT DU PROJET
   ════════════════════════════════════════════════════════════════════ */

function placerProjet(lat, lng) {
  /* Supprimer les couches précédentes */
  if (A.layerProjet) { A.carte.removeLayer(A.layerProjet); A.layerProjet = null; }
  if (A.layerCercle) { A.carte.removeLayer(A.layerCercle); A.layerCercle = null; }

  A.position = { lat: lat, lng: lng };

  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  var libelle  = typeInfo ? typeInfo.label : 'Projet';

  /* Marqueur : cercle rouge avec popup informatif */
  A.layerProjet = L.circleMarker([lat, lng], {
    radius: 11, fillColor: '#dc2626', color: '#fff', weight: 2.5, fillOpacity: .93,
  }).addTo(A.carte)
  .bindPopup(
    '<b>' + libelle + '</b>' +
    (A.superficieHa ? '<br/>Superficie : ' + A.superficieHa.toFixed(2) + ' ha' : '') +
    '<br/><small style="color:#666">Lat ' + lat.toFixed(5) + ' — Lng ' + lng.toFixed(5) + '</small>' +
    '<br/><small style="color:#888">Double-clic sur la carte pour déplacer</small>'
  );

  /* Cercle de superficie proportionnel (rayon = √(S/π)) */
  if (A.superficieHa && A.superficieHa > 0) {
    var rayon = Math.sqrt(A.superficieHa * 10000 / Math.PI);
    A.layerCercle = L.circle([lat, lng], {
      radius: rayon, color: '#dc2626', weight: 1.5, opacity: .7,
      fillColor: '#dc2626', fillOpacity: .10, dashArray: '5,4',
    }).addTo(A.carte);
  }

  /* Mise à jour de l'interface panneau */
  document.getElementById('pos-txt').textContent =
    'Lat ' + lat.toFixed(4) + ', Lng ' + lng.toFixed(4);
  document.getElementById('pos-info').classList.add('on');
  document.getElementById('btn-suppr').classList.add('on');
  document.getElementById('leg-projet').style.display = 'flex';
}

function supprimerProjet() {
  if (A.layerProjet) { A.carte.removeLayer(A.layerProjet); A.layerProjet = null; }
  if (A.layerCercle) { A.carte.removeLayer(A.layerCercle); A.layerCercle = null; }
  A.position = null;
  document.getElementById('pos-info').classList.remove('on');
  document.getElementById('btn-suppr').classList.remove('on');
  document.getElementById('leg-projet').style.display = 'none';
  desactiverDeplace();
}

/* ── Mode placement (simple clic) ──────────────────────────────── */
function togglePlacement() {
  if (A.modePlacement) { desactiverPlacement(); } else { activerPlacement(); }
}

function activerPlacement() {
  A.modePlacement = true;
  A.carte.getContainer().style.cursor = 'crosshair';
  var btn = document.getElementById('btn-placer');
  btn.classList.add('en-cours');
  btn.querySelector('#btn-placer-ico').textContent = '\u274C';
  btn.querySelector('#btn-placer-txt').textContent = 'Annuler le placement';
  document.getElementById('notif-placement').textContent = '\uD83D\uDCCD  Cliquez sur la carte pour placer votre projet';
  document.getElementById('notif-placement').classList.add('on');
}

function desactiverPlacement() {
  A.modePlacement = false;
  A.carte.getContainer().style.cursor = '';
  var btn = document.getElementById('btn-placer');
  btn.classList.remove('en-cours');
  btn.querySelector('#btn-placer-ico').innerHTML = '&#x1F4CD;';
  btn.querySelector('#btn-placer-txt').textContent = 'Placer le projet sur la carte';
  document.getElementById('notif-placement').classList.remove('on');
}

/* ── Mode déplacement (double-clic) ────────────────────────────── */
function activerDeplace() {
  A.modeDeplace = true;
  A.carte.getContainer().style.cursor = 'move';
  /* Passer le marqueur en mode "sélectionné" : contour jaune */
  if (A.layerProjet) {
    A.layerProjet.setStyle({ color: '#fbbf24', weight: 3.5 });
  }
  document.getElementById('notif-placement').textContent = '\u2725  Double-cliquez sur la carte pour déplacer le projet';
  document.getElementById('notif-placement').classList.add('on');
}

function desactiverDeplace() {
  A.modeDeplace = false;
  A.carte.getContainer().style.cursor = '';
  if (A.layerProjet) {
    A.layerProjet.setStyle({ color: '#fff', weight: 2.5 });
  }
  document.getElementById('notif-placement').classList.remove('on');
}

/* ════════════════════════════════════════════════════════════════════
   COUCHES THÉMATIQUES
   ════════════════════════════════════════════════════════════════════ */

/* Génère les boutons de contrôle des couches dans le panneau gauche */
function genControleCouches() {
  var conteneur = document.getElementById('layer-grid');
  conteneur.innerHTML = '';

  Object.keys(COUCHE_STYLES).forEach(function(themeId) {
    var style = COUCHE_STYLES[themeId];
    var btn = document.createElement('div');
    btn.className   = 'layer-toggle';
    btn.dataset.id  = themeId;
    btn.innerHTML =
      '<span class="layer-swatch" style="background:' + style.swatch + ';"></span>' +
      '<span class="layer-label">' + style.label + '</span>' +
      '<span class="layer-check">\u2713</span>';

    btn.addEventListener('click', function() { toggleCouche(themeId, btn); });
    conteneur.appendChild(btn);
  });
}

function toggleCouche(themeId, btn) {
  if (A.couchesActives.has(themeId)) {
    /* Désactiver : retirer de la carte */
    if (A.couches[themeId]) {
      A.carte.removeLayer(A.couches[themeId]);
      delete A.couches[themeId];
    }
    A.couchesActives.delete(themeId);
    btn.classList.remove('actif');
    majLegende();
  } else {
    /* Activer : charger et afficher */
    chargerCouche(themeId);
    A.couchesActives.add(themeId);
    btn.classList.add('actif');
    majLegende();
  }
}

function chargerCouche(themeId) {
  var data  = COUCHES_DATA[themeId];
  var style = COUCHE_STYLES[themeId];
  if (!data || !style) return;

  A.couches[themeId] = L.geoJSON(data, {
    style: function(feature) {
      var geomType = feature.geometry.type;
      if (geomType === 'LineString' || geomType === 'MultiLineString') {
        return { color: style.color, weight: 2.5, opacity: .75 };
      }
      return {
        color: style.color, weight: 1.5, opacity: .7,
        fillColor: style.fill, fillOpacity: .18,
      };
    },
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 7, fillColor: style.fill, color: style.color,
        weight: 2, opacity: 1, fillOpacity: .85,
      });
    },
    onEachFeature: function(feature, layer) {
      if (feature.properties && feature.properties.nom) {
        layer.bindTooltip(
          '<b style="font-family:serif">' + feature.properties.nom + '</b>' +
          (feature.properties.type ? '<br/><small>' + feature.properties.type + '</small>' : ''),
          { className: 'commune-tooltip', sticky: true }
        );
      }
      /* Propagation des clics pour que le placement fonctionne même sur les couches */
      layer.on('click',    function(e) { gererClicCarte(e.latlng.lat, e.latlng.lng); });
      layer.on('dblclick', function(e) { L.DomEvent.stopPropagation(e); gererDblClicCarte(e.latlng.lat, e.latlng.lng); });
    }
  }).addTo(A.carte);
}

/* Mise à jour de la légende en fonction des couches actives */
function majLegende() {
  var conteneur = document.getElementById('legende-couches');
  conteneur.innerHTML = '';

  A.couchesActives.forEach(function(themeId) {
    var style = COUCHE_STYLES[themeId];
    if (!style) return;
    var item = document.createElement('div');
    item.className = 'leg-item';
    item.innerHTML =
      '<div class="leg-color" style="background:' + style.swatch + ';"></div>' +
      '<span>' + style.label + '</span>';
    conteneur.appendChild(item);
  });
}

/* ════════════════════════════════════════════════════════════════════
   SUPERFICIE
   ════════════════════════════════════════════════════════════════════ */

function majSuperficie() {
  var val   = parseFloat(document.getElementById('inp-sup').value);
  var unite = document.getElementById('sel-unite').value;
  var chip  = document.getElementById('sup-chip');

  if (isNaN(val) || val <= 0) {
    A.superficieHa = null;
    chip.classList.remove('on');
    return;
  }

  /* Conversion en hectares */
  A.superficieHa = unite === 'ha' ? val : (unite === 'm2' ? val / 10000 : val * 100);

  document.getElementById('sup-chip-txt').textContent = A.superficieHa < 1
    ? (A.superficieHa * 10000).toFixed(0) + '\u00a0m\u00B2 (' + A.superficieHa.toFixed(4) + '\u00a0ha)'
    : A.superficieHa.toFixed(2) + '\u00a0ha';
  chip.classList.add('on');

  /* Suggestion automatique de la taille réglementaire */
  majTaille(A.superficieHa >= 20 ? 4 : A.superficieHa >= 5 ? 3 : A.superficieHa >= 0.5 ? 2 : 1);

  /* Actualiser le cercle si le projet est déjà placé */
  if (A.position) placerProjet(A.position.lat, A.position.lng);
}

/* ════════════════════════════════════════════════════════════════════
   CONTRÔLES DU PANNEAU GAUCHE
   ════════════════════════════════════════════════════════════════════ */

function genBoutons() {
  var grille = document.getElementById('grille-types');
  grille.innerHTML = '';
  TYPES.forEach(function(type) {
    var btn = document.createElement('button');
    btn.className    = 'btn-type';
    btn.dataset.type = type.id;
    btn.innerHTML    = '<span class="ico">' + type.ico + '</span>' + type.label;
    btn.addEventListener('click', function(){ selType(btn); });
    grille.appendChild(btn);
  });
}

function selType(btn) {
  document.querySelectorAll('.btn-type').forEach(function(b){ b.classList.remove('actif'); });
  btn.classList.add('actif');
  A.typeProjet = btn.dataset.type;
  var t = TYPES.find(function(x){ return x.id === A.typeProjet; });
  if (t) {
    document.getElementById('hdr-badge-txt').innerHTML = t.ico + '&nbsp;' + t.label;
    document.getElementById('hdr-badge').style.display = 'flex';
  }
}

function majTaille(val) {
  A.taille = parseInt(val);
  var t = TAILLES[A.taille];
  document.getElementById('taille-nom').textContent  = t.nom;
  document.getElementById('taille-desc').textContent = t.desc;
  document.getElementById('slider-taille').value = A.taille;
}

function genBadgesThemes() {
  var grille = document.getElementById('grille-themes');
  grille.innerHTML = '';
  THEMES.forEach(function(theme) {
    var b = document.createElement('div');
    b.className  = 'badge-theme ' + theme.classe + ' actif';
    b.dataset.id = theme.id;
    b.innerHTML  = theme.icone + ' ' + theme.label;
    b.addEventListener('click', function() {
      if (A.themesActifs.has(theme.id)) {
        A.themesActifs.delete(theme.id);
        b.classList.replace('actif', 'inactif');
      } else {
        A.themesActifs.add(theme.id);
        b.classList.replace('inactif', 'actif');
      }
    });
    grille.appendChild(b);
  });
}

/* ════════════════════════════════════════════════════════════════════
   ANALYSE DES ENJEUX
   ════════════════════════════════════════════════════════════════════ */

function lancerAnalyse() {
  if (!A.typeProjet) { alert("Selectionnez d'abord un type de projet."); return; }

  var tous    = ENJEUX[A.typeProjet] || [];
  var filtres = tous.filter(function(e) {
    return e.tmin <= A.taille && A.themesActifs.has(e.theme);
  });

  /* Tri : Élevé > Moyen > Faible */
  var ord = { eleve:0, moyen:1, faible:2 };
  filtres.sort(function(a, b){ return ord[a.niv] - ord[b.niv]; });

  /* Mise à jour en-tête du panneau droit */
  var t = TYPES.find(function(x){ return x.id === A.typeProjet; });
  document.querySelector('#enjeux-hdr h2').textContent = 'Enjeux \u2014 ' + (t ? t.label : '');

  var infos = [filtres.length + ' enjeu(x)', TAILLES[A.taille].nom];
  if (A.superficieHa) infos.push(A.superficieHa.toFixed(2) + ' ha');
  if (A.position)     infos.push('Projet positionn\u00e9');
  document.getElementById('enjeux-sous-titre').textContent = infos.join(' \u00B7 ');

  /* Afficher la liste */
  document.getElementById('msg-accueil').style.display = 'none';
  var liste = document.getElementById('liste-enjeux');
  liste.style.display = 'flex';
  liste.innerHTML = '';

  if (filtres.length === 0) {
    liste.innerHTML =
      '<div style="text-align:center;padding:32px 20px;color:var(--ink-3);">' +
        '<div style="font-size:2.2rem;margin-bottom:12px;">&#x2705;</div>' +
        '<p style="font-size:.82rem;line-height:1.6;">Aucun enjeu identifie pour les filtres selectionnes.</p>' +
      '</div>';
    return;
  }

  filtres.forEach(function(e){ liste.appendChild(creerCardEnjeu(e)); });

  /* Afficher la section contacts en bas du panneau */
  afficherContacts();
}

/* ════════════════════════════════════════════════════════════════════
   GÉNÉRATION DES CARTES ENJEUX
   ════════════════════════════════════════════════════════════════════ */

function creerCardEnjeu(e) {
  var couleurs = {
    prevention:    '#b45309',   /* orange — carte mentale */
    economique:    '#7c3aed',   /* violet */
    cartographie:  '#0d9488',   /* teal/vert */
    social:        '#be123c',   /* rose/saumon */
    environnement: '#15803d',   /* vert */
    politique:     '#92400e',   /* brun/dore */
  };
  var noms = { eleve:'Elevé', moyen:'Moyen', faible:'Faible' };

  var liens = e.cartes.map(function(c) {
    return '<span class="enjeu-lien" data-id="' + e.id + '">&#x1F5FA; ' + c.n + ' \u2014 ' + c.t + '</span>';
  }).join('');

  var pts = e.pts.map(function(p){ return '<li>' + p + '</li>'; }).join('');

  var div = document.createElement('div');
  div.className = 'enjeu-card';
  div.style.borderLeftColor = couleurs[e.theme] || '#002395';
  div.innerHTML =
    '<div class="enjeu-head">' +
      '<span class="enjeu-ico">' + e.ico + '</span>' +
      '<div class="enjeu-meta">' +
        '<div class="enjeu-nom">' + e.nom + '</div>' +
        '<div class="enjeu-ref">' + e.ref + '</div>' +
      '</div>' +
      '<span class="niv-badge n-' + e.niv + '">' + noms[e.niv] + '</span>' +
      '<span class="enjeu-chev">&#9654;</span>' +
    '</div>' +
    '<div class="enjeu-body">' +
      '<p class="enjeu-desc">' + e.desc + '</p>' +
      '<ul class="enjeu-pts">' + pts + '</ul>' +
      '<div class="enjeu-liens">' + liens + '</div>' +
    '</div>';

  /* Déplier / replier */
  div.querySelector('.enjeu-head').addEventListener('click', function() {
    div.classList.toggle('ouvert');
  });

  /* Ouvrir la modale au clic sur un lien de carte */
  div.querySelectorAll('.enjeu-lien').forEach(function(lien) {
    lien.addEventListener('click', function(ev) {
      ev.stopPropagation();
      ouvrirModale(lien.dataset.id);
    });
  });

  return div;
}

/* ════════════════════════════════════════════════════════════════════
   MODALE
   ════════════════════════════════════════════════════════════════════ */

function ouvrirModale(id) {
  var enjeu = null;
  var listes = Object.values(ENJEUX);
  for (var i = 0; i < listes.length; i++) {
    var f = listes[i].find(function(x){ return x.id === id; });
    if (f) { enjeu = f; break; }
  }
  if (!enjeu) return;
  document.getElementById('modale-titre').textContent = enjeu.nom;
  document.getElementById('modale-ref').textContent   = enjeu.ref;
  document.getElementById('modale-corps').innerHTML   = enjeu.detail;
  document.getElementById('modale-bg').classList.add('on');
}

function fermerModale(evt, force) {
  if (force || (evt && evt.target.id === 'modale-bg')) {
    document.getElementById('modale-bg').classList.remove('on');
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') fermerModale(null, true);
});

/* ════════════════════════════════════════════════════════════════════
   BASE DE DONNEES DES CONTACTS
   Organisee par : groupe > contacts individuels
   Chaque contact peut etre filtre par type de projet (types: [])
   et par taille minimale (tmin: 1-4).
   priorite : 'obligatoire' | 'recommande' | 'optionnel'
   ════════════════════════════════════════════════════════════════════ */
var CONTACTS_DB = {

  /* ── SERVICES DE L'ETAT ──────────────────────────────────────── */
  etat: {
    label: 'Services de l\'Etat',
    ico:   '&#x1F3DB;',
    contacts: [
      {
        id:        'ddt90',
        nom:       'DDT 90 — Direction Departementale des Territoires',
        role:      'Service instructeur : urbanisme, agriculture, environnement, risques. Interlocuteur principal pour tout projet sur le Territoire de Belfort.',
        priorite:  'obligatoire',
        types:     ['logement','zae','equipement','energie','transport','agriculture','nature','friche'],
        tmin:      1,
        tel:       '03 84 58 86 00',
        email:     'ddt@territoire-de-belfort.gouv.fr',
        adresse:   '8 place de la Revolution Francaise, 90000 Belfort',
        web:       'https://www.territoire-de-belfort.gouv.fr',
        horaires:  'Lun-Ven 8h30-12h00 / 13h30-16h00',
        note:      'Contacter le service Urbanisme et Habitat (SUH) pour les projets de construction, le service Environnement pour les projets sensibles, le service Agriculture pour les projets agricoles.',
      },
      {
        id:        'prefet90',
        nom:       'Prefecture du Territoire de Belfort',
        role:      'Autorite prefectorale : enquetes publiques, declarations d\'utilite publique, actes d\'urbanisme en zone RNU, coordination des services de l\'Etat.',
        priorite:  'recommande',
        types:     ['logement','zae','equipement','energie','transport','friche'],
        tmin:      2,
        tel:       '03 84 98 11 11',
        email:     'contact@territoire-de-belfort.gouv.fr',
        adresse:   '1 rue de la Prefecture, 90020 Belfort Cedex',
        web:       'https://www.territoire-de-belfort.gouv.fr/prefecture',
        horaires:  'Lun-Ven 8h30-12h00 / 13h30-16h30',
        note:      '[PLACEHOLDER] Service juridique et urbanisme.',
      },
      {
        id:        'udap90',
        nom:       'UDAP 90 — Architecte des Batiments de France',
        role:      'Avis sur les projets en perimetre de monument historique (500 m) et en site classe/inscrit. Obligatoire pour tout projet dans un secteur protege.',
        priorite:  'obligatoire',
        types:     ['logement','zae','equipement','energie','patrimoine'],
        tmin:      1,
        tel:       '03 84 28 70 01',
        email:     'udap-90@culture.gouv.fr',
        adresse:   '[PLACEHOLDER] 90000 Belfort',
        web:       'https://www.culture.gouv.fr/Regions/DRAC-Bourgogne-Franche-Comte',
        horaires:  '[PLACEHOLDER] Sur rendez-vous',
        note:      'Contacter en amont si le projet est situe a moins de 500 m d\'un monument historique classe ou inscrit.',
      },
      {
        id:        'ars',
        nom:       'ARS BFC — Agence Regionale de Sante',
        role:      'Avis sanitaire : etablissements de sante, captages AEP, assainissement, radon dans les ERP, risques sanitaires environnementaux.',
        priorite:  'recommande',
        types:     ['equipement','logement','nature'],
        tmin:      1,
        tel:       '03 80 41 98 98',
        email:     'ars-bfc-dt90@ars.sante.fr',
        adresse:   '[PLACEHOLDER] 90000 Belfort',
        web:       'https://www.bourgogne-franche-comte.ars.sante.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Consultation obligatoire pour les etablissements de sante et les projets impactant les captages AEP.',
      },
    ]
  },

  /* ── INTERCOMMUNALITES ───────────────────────────────────────── */
  epci: {
    label: 'Intercommunalites',
    ico:   '&#x1F3D8;',
    contacts: [
      {
        id:        'gbca',
        nom:       'Grand Belfort Communaute d\'Agglomeration (GBCA)',
        role:      'Competences : urbanisme (PLU), economie, habitat, transports, environnement. Regroupe Belfort et 49 communes — 73% de la population du 90.',
        priorite:  'obligatoire',
        types:     ['logement','zae','equipement','energie','transport','friche'],
        tmin:      1,
        tel:       '03 84 90 72 00',
        email:     'contact@grandbelfort.fr',
        adresse:   '1 rue Georges Pompidou, BP 10 649, 90020 Belfort Cedex',
        web:       'https://www.grandbelfort.fr',
        horaires:  'Lun-Ven 8h30-12h00 / 13h30-17h00',
        note:      'Interlocuteur pour les projets situes dans les 50 communes de GBCA. Contacter le service Urbanisme pour les PLU et le service Developpement Economique pour les ZAE.',
      },
      {
        id:        'ccvs',
        nom:       'Communaute de Communes des Vosges du Sud (CCVS)',
        role:      'Regroupe 22 communes au nord du departement (Giromagny, Rougegoutte...). PLUi en cours d\'elaboration. Competences : economie locale, tourisme, voirie.',
        priorite:  'recommande',
        types:     ['logement','zae','equipement','agriculture','nature'],
        tmin:      1,
        tel:       '03 84 29 14 00',
        email:     '[PLACEHOLDER]@vosges-du-sud.fr',
        adresse:   'Mairie de Giromagny, 4 rue de l\'Hotel de Ville, 90200 Giromagny',
        web:       'https://www.ccvosgesdu-sud.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'PLUi CCVS en cours d\'elaboration (2025). Contacter pour verifier les implications sur le zonage futur.',
      },
      {
        id:        'ccst',
        nom:       'Communaute de Communes du Sud Territoire (CCST)',
        role:      'Regroupe les communes du sud (Delle, Beaucourt, Grandvillars...). Programme agroecologique "L\'Eau d\'Ici". Competences : economie, transports, habitat.',
        priorite:  'recommande',
        types:     ['logement','zae','equipement','agriculture','eau'],
        tmin:      1,
        tel:       '03 84 36 21 35',
        email:     '[PLACEHOLDER]@sudterritoire.fr',
        adresse:   'Hotel de Ville, 1 place de la Republique, 90100 Delle',
        web:       '[PLACEHOLDER]',
        horaires:  '[PLACEHOLDER]',
        note:      'Zone transfrontaliere avec la Suisse. Specifites liees aux travailleurs frontaliers et aux projets proches de la frontiere.',
      },
    ]
  },

  /* ── EXPERTS ENVIRONNEMENT ───────────────────────────────────── */
  environnement: {
    label: 'Experts Environnement & Nature',
    ico:   '&#x1F333;',
    contacts: [
      {
        id:        'dreal',
        nom:       'DREAL BFC — Direction Regionale Environnement, Amenagement, Logement',
        role:      'Expertise environnementale regionale : Natura 2000, especes protegees, evaluation environnementale des plans et programmes, risques industriels (ICPE).',
        priorite:  'recommande',
        types:     ['energie','zae','transport','nature'],
        tmin:      2,
        tel:       '03 80 68 44 00',
        email:     'dreal-bfc@developpement-durable.gouv.fr',
        adresse:   '17 bis rue Archimede, CS 57067, 21000 Dijon',
        web:       'https://www.bourgogne-franche-comte.developpement-durable.gouv.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Saisir la DREAL pour les projets soumis a evaluation environnementale (seuils fixes par le Code de l\'environnement).',
      },
      {
        id:        'onf',
        nom:       'ONF — Office National des Forets (UT Vosges du Nord / Franche-Comte)',
        role:      'Gestion des forets publiques du departement. Expertise : sylviculture, biodiversite forestiere, risques naturels en zone boisee.',
        priorite:  'recommande',
        types:     ['nature','energie','agriculture'],
        tmin:      1,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER] Belfort',
        web:       'https://www.onf.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Contacter l\'agence ONF competente pour tout projet en zone forestiere ou en lisiere de foret publique.',
      },
      {
        id:        'agence-eau',
        nom:       'Agence de l\'Eau Rhone-Mediterranee-Corse',
        role:      'Financement des projets de restauration de cours d\'eau, zones humides et amelioration de la qualite de l\'eau. Bassin RMC dont fait partie le Territoire de Belfort.',
        priorite:  'recommande',
        types:     ['eau','nature','agriculture'],
        tmin:      1,
        tel:       '04 72 71 26 70',
        email:     'direction.lyon@eaurmc.fr',
        adresse:   '2-4 allee de Lodz, 69363 Lyon Cedex 07',
        web:       'https://www.eaurmc.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Guichet de financement pour les projets de restauration morphologique des cours d\'eau et de reconquete de la qualite de l\'eau.',
      },
      {
        id:        'atmo',
        nom:       'ATMO Bourgogne-Franche-Comte',
        role:      'Surveillance de la qualite de l\'air. Fourniture des donnees de la Carte Strategique de l\'Air (CSA) utilisee dans l\'Atlas DDT 90 (C18).',
        priorite:  'optionnel',
        types:     ['logement','zae','equipement','transport'],
        tmin:      2,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER]',
        web:       'https://www.atmo-bfc.org',
        horaires:  '[PLACEHOLDER]',
        note:      'Consulter pour les projets dans les secteurs a qualite d\'air degradee (axes routiers a fort trafic, zones industrielles).',
      },
    ]
  },

  /* ── AGRICULTURE & FONCIER ───────────────────────────────────── */
  agriculture: {
    label: 'Agriculture & Foncier',
    ico:   '&#x1F33E;',
    contacts: [
      {
        id:        'chambre-agri',
        nom:       'Chambre d\'Agriculture du Territoire de Belfort',
        role:      'Conseil et expertise agricole. Avis consultatif sur les projets impactant les terres agricoles. Accompagnement des porteurs de projets agri.',
        priorite:  'obligatoire',
        types:     ['agriculture','logement','zae','nature','friche'],
        tmin:      1,
        tel:       '03 84 22 31 32',
        email:     'chambre-agriculture-90@agri90.fr',
        adresse:   '7 rue du General Passaga, BP 40 034, 90001 Belfort Cedex',
        web:       'https://www.agri90.fr',
        horaires:  'Lun-Ven 8h30-12h00 / 13h30-17h00',
        note:      'Consultation recommandee avant tout projet consommateur de foncier agricole. Participe a la CDPENAF.',
      },
      {
        id:        'safer',
        nom:       'SAFER Bourgogne-Franche-Comte',
        role:      'Societe d\'amenagement foncier. Droit de preemption sur les ventes de terres agricoles. Accompagnement des transactions foncieres.',
        priorite:  'recommande',
        types:     ['agriculture','logement','zae','friche'],
        tmin:      1,
        tel:       '03 80 68 64 00',
        email:     'safer@safer-bfc.fr',
        adresse:   '4 bis boulevard de la Tremoille, BP 21531, 21015 Dijon Cedex',
        web:       'https://www.safer-bfc.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Informer la SAFER de tout projet foncier concernant des terres agricoles pour eviter un droit de preemption tardif.',
      },
      {
        id:        'epf-bfc',
        nom:       'EPF BFC — Etablissement Public Foncier',
        role:      'Portage foncier pour les collectivites. Intervention sur les friches industrielles et commerciales. Preamenagement et portage temporaire.',
        priorite:  'recommande',
        types:     ['friche','logement','zae'],
        tmin:      2,
        tel:       '03 80 28 59 20',
        email:     'contact@epf-bfc.fr',
        adresse:   '9 boulevard Carnot, BP 78, 21003 Dijon Cedex',
        web:       'https://www.epf-bfc.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'L\'EPF peut porter le foncier pendant l\'etude et le portage du projet. Contacter en amont pour les projets de rehabilitation de friches complexes.',
      },
    ]
  },

  /* ── URBANISME & PLANIFICATION ───────────────────────────────── */
  urbanisme: {
    label: 'Urbanisme & Planification',
    ico:   '&#x1F4CB;',
    contacts: [
      {
        id:        'autb',
        nom:       'AUTB — Agence d\'Urbanisme du Territoire de Belfort',
        role:      'Expertise en urbanisme et planification territoriale. Accompagnement des collectivites pour les SCoT, PLU et PLUi. Observatoire foncier.',
        priorite:  'recommande',
        types:     ['logement','zae','equipement','transport','friche'],
        tmin:      2,
        tel:       '03 84 21 52 70',
        email:     'contact@autb.fr',
        adresse:   '4 rue de la Faucille, 90000 Belfort',
        web:       'https://www.autb.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Ressource cle pour les etudes de planification et d\'urbanisme. Dispose de l\'observatoire foncier du Territoire de Belfort.',
      },
      {
        id:        'cerema',
        nom:       'CEREMA — Centre d\'Etudes et d\'Expertise sur les Risques',
        role:      'Appui technique de l\'Etat aux collectivites : risques naturels, bruit, mobilites, ingenerie de projets complexes, rehabilitation de friches.',
        priorite:  'optionnel',
        types:     ['transport','friche','energie','risques'],
        tmin:      3,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER]',
        web:       'https://www.cerema.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Mobilisable sur mission specifique pour les projets complexes necessitant une expertise technique pointue.',
      },
    ]
  },

  /* ── ENERGIE & TRANSITION ────────────────────────────────────── */
  energie: {
    label: 'Energie & Transition ecologique',
    ico:   '&#x26A1;',
    contacts: [
      {
        id:        'ademe90',
        nom:       'ADEME — Agence de la Transition Ecologique (antenne BFC)',
        role:      'Financement et expertise : efficacite energetique, ENR, rehabilitation de friches polluees (Fonds Friches), economie circulaire.',
        priorite:  'recommande',
        types:     ['energie','friche','zae','equipement'],
        tmin:      1,
        tel:       '03 81 47 20 90',
        email:     'ademe-bfc@ademe.fr',
        adresse:   '9 rue Beauregard, 25000 Besancon',
        web:       'https://bourgogne-franche-comte.ademe.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Guichet Fonds Friches pour les projets de rehabilitation de sites pollues. Accompagnement technique et financier.',
      },
      {
        id:        'te90',
        nom:       'Territoire d\'Energie 90',
        role:      'Syndicat d\'energie du departement. Gestion des reseaux de distribution electrique et gaz. Cadastre solaire (Atlas C22). Accompagnement ENR.',
        priorite:  'recommande',
        types:     ['energie','logement','equipement','zae'],
        tmin:      1,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER] Belfort',
        web:       '[PLACEHOLDER]',
        horaires:  '[PLACEHOLDER]',
        note:      'Contact privilegie pour le cadastre solaire et les questions de raccordement aux reseaux d\'energie.',
      },
      {
        id:        'enedis',
        nom:       'Enedis — Gestionnaire Reseau Distribution (GRD)',
        role:      'Raccordement au reseau de distribution electrique. Etudes de raccordement pour les installations de production ENR et les nouvelles constructions.',
        priorite:  'recommande',
        types:     ['energie','logement','zae','equipement'],
        tmin:      1,
        tel:       '09 70 83 19 70',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER] Belfort',
        web:       'https://www.enedis.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Contacter pour toute demande de raccordement ou etude de capacite d\'injection pour les projets ENR.',
      },
    ]
  },

  /* ── FINANCEMENT & INGENIERIE ────────────────────────────────── */
  financement: {
    label: 'Financement & Ingenierie de projet',
    ico:   '&#x1F4B6;',
    contacts: [
      {
        id:        'banque-terr',
        nom:       'Banque des Territoires (Caisse des Depots)',
        role:      'Financement des projets d\'investissement des collectivites : logement social, infrastructure, renovation energetique, numerique.',
        priorite:  'recommande',
        types:     ['logement','equipement','energie','friche'],
        tmin:      2,
        tel:       '03 81 65 55 00',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER] Besancon',
        web:       'https://www.banquedesterritoires.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Interlocuteur cle pour les collectivites cherchant des co-financements sur des projets structurants.',
      },
      {
        id:        'anct',
        nom:       'ANCT — Agence Nationale de Cohesion des Territoires',
        role:      'Pilotage des programmes ACV et PVD. Ingenierie de projet pour les communes labellisees. Fonds vert.',
        priorite:  'optionnel',
        types:     ['logement','friche','equipement'],
        tmin:      1,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER]',
        web:       'https://agence-cohesion-territoires.gouv.fr',
        horaires:  '[PLACEHOLDER]',
        note:      'Passer par le delegue territorial (Prefet) pour acceder aux programmes ANCT (ACV, PVD).',
      },
    ]
  },

  /* ── EXPERTS LOCAUX & BUREAUX D'ETUDES ───────────────────────── */
  experts: {
    label: 'Experts locaux & Bureaux d\'etudes',
    ico:   '&#x1F9D1;&#x200D;&#x1F4BC;',
    contacts: [
      {
        id:        'geo-bm',
        nom:       '[PLACEHOLDER] Bureau d\'etudes en geotechnique',
        role:      'Etudes geotechniques (G1, G2) : fondations, retrait-gonflement des argiles, mouvements de terrain. Obligatoire en zone d\'exposition argiles.',
        priorite:  'obligatoire',
        types:     ['logement','zae','equipement'],
        tmin:      1,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER] Belfort / Montbeliard',
        web:       '[PLACEHOLDER]',
        horaires:  '[PLACEHOLDER]',
        note:      'Plusieurs bureaux d\'etudes geotechniques operent dans le 90. Contacter la DDT 90 pour une liste de prestataires agrees.',
      },
      {
        id:        'bureau-enviro',
        nom:       '[PLACEHOLDER] Bureau d\'etudes environnementales',
        role:      'Etudes d\'impact environnemental, inventaires naturalistes, evaluation d\'incidences Natura 2000, etudes de bruit, qualite de l\'air.',
        priorite:  'recommande',
        types:     ['energie','zae','transport','nature'],
        tmin:      2,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER]',
        web:       '[PLACEHOLDER]',
        horaires:  '[PLACEHOLDER]',
        note:      'Obligatoire pour les projets soumis a evaluation environnementale. La DDT 90 dispose d\'une liste de bureaux d\'etudes locaux.',
      },
      {
        id:        'architecte',
        nom:       'CAUE 90 — Conseil Architecture Urbanisme Environnement',
        role:      'Conseil independant en architecture, urbanisme et paysage. Accompagnement gratuit des elus et des particuliers. Integration paysagere des projets.',
        priorite:  'recommande',
        types:     ['logement','equipement','zae','patrimoine'],
        tmin:      1,
        tel:       '[PLACEHOLDER]',
        email:     '[PLACEHOLDER]',
        adresse:   '[PLACEHOLDER] Belfort',
        web:       '[PLACEHOLDER]',
        horaires:  '[PLACEHOLDER]',
        note:      'Ressource precieuse pour les questions d\'integration architecturale et paysagere, notamment en secteur sensible.',
      },
    ]
  },
};

/* ════════════════════════════════════════════════════════════════════
   LOGIQUE CONTACTS
   ════════════════════════════════════════════════════════════════════ */

/* Etat du panneau contacts */
var contactsOuverts = false;

/* Affiche la section contacts apres une analyse */
function afficherContacts() {
  var section = document.getElementById('section-contacts');
  section.style.display = 'block';
  /* Re-generer le contenu a chaque analyse */
  genererContacts();
}

/* Ouvre / ferme le panneau depliable */
function toggleContacts() {
  contactsOuverts = !contactsOuverts;
  var panel   = document.getElementById('contacts-panel');
  var trigger = document.getElementById('contacts-trigger');
  var chev    = document.getElementById('contacts-chev');

  if (contactsOuverts) {
    panel.classList.remove('contacts-hidden');
    panel.classList.add('contacts-visible');
    trigger.classList.add('ouvert');
  } else {
    panel.classList.remove('contacts-visible');
    panel.classList.add('contacts-hidden');
    trigger.classList.remove('ouvert');
  }
}

/* Genere la liste des contacts filtres selon le projet courant */
function genererContacts() {
  var type    = A.typeProjet;
  var taille  = A.taille;

  /* ── Contexte du projet ── */
  var ctxEl  = document.getElementById('contacts-ctx');
  var typeInfo = TYPES.find(function(t){ return t.id === type; });
  var chips  = [];
  if (typeInfo) chips.push(typeInfo.ico + ' ' + typeInfo.label);
  chips.push(TAILLES[taille].nom);
  if (A.superficieHa) chips.push(A.superficieHa.toFixed(2) + ' ha');
  if (A.position) chips.push('Lat ' + A.position.lat.toFixed(3) + ', Lng ' + A.position.lng.toFixed(3));

  ctxEl.innerHTML = '<span style="color:var(--rf-mid);font-weight:600;font-size:.72rem;margin-right:4px;">Projet :</span>' +
    chips.map(function(c){
      return '<span class="ctx-chip">' + c + '</span>';
    }).join('');

  /* ── Liste des groupes ── */
  var liste  = document.getElementById('contacts-liste');
  liste.innerHTML = '';
  var totalAffiche = 0;

  Object.keys(CONTACTS_DB).forEach(function(groupeId) {
    var groupe = CONTACTS_DB[groupeId];

    /* Filtrer les contacts du groupe selon type & taille */
    var contactsFiltres = groupe.contacts.filter(function(c) {
      return c.types.indexOf(type) !== -1 && c.tmin <= taille;
    });

    if (contactsFiltres.length === 0) return;
    totalAffiche += contactsFiltres.length;

    /* Trier : obligatoire > recommande > optionnel */
    var prioOrd = { obligatoire: 0, recommande: 1, optionnel: 2 };
    contactsFiltres.sort(function(a, b){
      return prioOrd[a.priorite] - prioOrd[b.priorite];
    });

    /* Creer le groupe */
    var groupeEl = document.createElement('div');
    groupeEl.className = 'contact-groupe';
    groupeEl.innerHTML =
      '<div class="contact-groupe-titre">' +
        '<span class="groupe-ico">' + groupe.ico + '</span>' +
        groupe.label +
      '</div>';

    /* Ajouter chaque carte contact */
    contactsFiltres.forEach(function(c) {
      groupeEl.appendChild(creerCarteContact(c));
    });

    liste.appendChild(groupeEl);
  });

  /* Message si aucun contact */
  if (totalAffiche === 0) {
    liste.innerHTML =
      '<div class="contacts-vide">' +
        '&#x1F50D; Aucun contact specifique identifie pour ce type de projet.<br/>' +
        'Contactez directement la DDT 90 au 03 84 58 86 00.' +
      '</div>';
  }
}

/* Cree une carte contact individuelle */
function creerCarteContact(c) {
  var prioBadge = {
    obligatoire: '<span class="contact-priorite prio-obligatoire">Obligatoire</span>',
    recommande:  '<span class="contact-priorite prio-recommande">Recommande</span>',
    optionnel:   '<span class="contact-priorite prio-optionnel">Optionnel</span>',
  };

  /* Coordonnees */
  var coords = [];
  if (c.tel) {
    var telHref = c.tel.startsWith('[') ? '#' : 'tel:' + c.tel.replace(/\s/g,'');
    var telClass = c.tel.startsWith('[') ? 'contact-placeholder' : 'contact-lien';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x1F4DE;</span>' +
        '<a class="' + telClass + '" href="' + telHref + '">' + c.tel + '</a>' +
      '</div>'
    );
  }
  if (c.email) {
    var emailHref  = c.email.startsWith('[') ? '#' : 'mailto:' + c.email;
    var emailClass = c.email.startsWith('[') ? 'contact-placeholder' : 'contact-lien';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x2709;</span>' +
        '<a class="' + emailClass + '" href="' + emailHref + '">' + c.email + '</a>' +
      '</div>'
    );
  }
  if (c.adresse) {
    var adresseClass = c.adresse.startsWith('[') ? 'contact-placeholder' : '';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x1F4CD;</span>' +
        '<span class="' + adresseClass + '">' + c.adresse + '</span>' +
      '</div>'
    );
  }
  if (c.horaires) {
    var horClass = c.horaires.startsWith('[') ? 'contact-placeholder' : '';
    coords.push(
      '<div class="contact-ligne">' +
        '<span class="c-ico">&#x1F552;</span>' +
        '<span class="' + horClass + '">' + c.horaires + '</span>' +
      '</div>'
    );
  }

  /* Boutons d'action */
  var actions = [];
  if (c.tel && !c.tel.startsWith('[')) {
    actions.push(
      '<a class="btn-contact-action btn-appel" href="tel:' + c.tel.replace(/\s/g,'') + '">' +
        '&#x1F4DE; Appeler' +
      '</a>'
    );
  }
  if (c.email && !c.email.startsWith('[')) {
    actions.push(
      '<a class="btn-contact-action btn-email" href="mailto:' + c.email + '">' +
        '&#x2709; Email' +
      '</a>'
    );
  }
  if (c.web && !c.web.startsWith('[')) {
    actions.push(
      '<a class="btn-contact-action btn-web" href="' + c.web + '" target="_blank" rel="noopener">' +
        '&#x1F517; Site web' +
      '</a>'
    );
  }

  /* Note contextuelle */
  var noteHtml = c.note
    ? '<div style="margin-top:8px;font-size:.72rem;color:var(--ink-3);background:var(--bg);border-radius:var(--r-sm);padding:6px 9px;line-height:1.5;border-left:2px solid var(--border-2);">' +
        '&#x2139; ' + c.note +
      '</div>'
    : '';

  var div = document.createElement('div');
  div.className = 'contact-card';
  div.innerHTML =
    prioBadge[c.priorite] +
    '<div class="contact-nom">' + c.nom + '</div>' +
    '<div class="contact-role">' + c.role + '</div>' +
    '<div class="contact-coords">' + coords.join('') + '</div>' +
    (actions.length ? '<div class="contact-actions">' + actions.join('') + '</div>' : '') +
    noteHtml;

  return div;
}

/* ════════════════════════════════════════════════════════════════════
   SOUS-TYPES — logique UI
   ════════════════════════════════════════════════════════════════════ */

/* Etat */
A.sousType = null;

/* Affiche le menu secondaire après sélection d'un type */
function afficherSousTypes(typeId) {
  var wrap   = document.getElementById('sous-types-wrap');
  var grille = document.getElementById('grille-sous-types');
  var desc   = document.getElementById('stype-desc');
  var sousTypesListe = SOUS_TYPES[typeId];

  if (!sousTypesListe || sousTypesListe.length === 0) {
    wrap.classList.remove('visible');
    A.sousType = null;
    return;
  }

  grille.innerHTML = '';
  desc.classList.remove('on');
  A.sousType = null;

  sousTypesListe.forEach(function(st) {
    var btn = document.createElement('button');
    btn.className    = 'btn-stype';
    btn.dataset.id   = st.id;
    btn.innerHTML    =
      '<span class="sico">' + st.ico + '</span>' +
      '<span class="stxt">' + st.label +
      '</span>';
    btn.addEventListener('click', function() { selSousType(btn, st); });
    grille.appendChild(btn);
  });

  wrap.classList.add('visible');
}

/* Sélectionne un type */
function selSousType(btn, st) {
  document.querySelectorAll('.btn-stype').forEach(function(b){ b.classList.remove('actif'); });
  btn.classList.add('actif');
  A.sousType = st.id;

  var desc = document.getElementById('stype-desc');
  desc.textContent = st.desc;
  desc.classList.add('on');

  /* Mise à jour du badge header */
  var badge = document.getElementById('hdr-badge-txt');
  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  if (typeInfo) {
    badge.innerHTML = typeInfo.ico + '&nbsp;' + typeInfo.label + '&nbsp;<span style="opacity:.7;font-weight:400">›</span>&nbsp;' + st.label;
  }
}

/* Patch selType pour afficher les sous-types */
var _selTypeOrig = selType;
selType = function(btn) {
  _selTypeOrig(btn);
  A.sousType = null;
  document.getElementById('stype-desc').classList.remove('on');
  afficherSousTypes(A.typeProjet);
};

/* ════════════════════════════════════════════════════════════════════
   CHECKLIST — logique UI
   ════════════════════════════════════════════════════════════════════ */

var checklistOuverte = false;
var checklistEtats   = {};  /* { itemId: 'done' | 'expanded' | '' } */

/* Affiche la section checklist après analyse */
function afficherChecklist() {
  var section = document.getElementById('section-checklist');
  section.style.display = 'block';
  genererChecklist();
}

/* Toggle ouverture */
function toggleChecklist() {
  checklistOuverte = !checklistOuverte;
  var panel   = document.getElementById('checklist-panel');
  var trigger = document.getElementById('checklist-trigger');

  if (checklistOuverte) {
    panel.classList.remove('cl-hidden');
    panel.classList.add('cl-visible');
    trigger.classList.add('ouvert');
  } else {
    panel.classList.remove('cl-visible');
    panel.classList.add('cl-hidden');
    trigger.classList.remove('ouvert');
  }
}

/* Génère la checklist selon le sous-type courant (ou _default) */
function genererChecklist() {
  var clKey   = A.sousType || '_default';
  var etapes  = CHECKLISTS[clKey] || CHECKLISTS['_default'];
  var ctxEl   = document.getElementById('checklist-ctx');
  var bodyEl  = document.getElementById('checklist-body');

  /* Contexte */
  var typeInfo  = TYPES.find(function(t){ return t.id === A.typeProjet; });
  var stList    = SOUS_TYPES[A.typeProjet] || [];
  var stInfo    = stList.find(function(s){ return s.id === A.sousType; });
  var ctxTxt    = typeInfo ? typeInfo.ico + ' ' + typeInfo.label : '';
  if (stInfo)   ctxTxt += ' › ' + stInfo.label;
  ctxTxt += ' — ' + etapes.length + ' etape(s) administratives';
  ctxEl.textContent = ctxTxt;

  /* Regrouper par phase */
  var phases = ['avant','instruction','travaux','reception','post'];
  var phaseLabels = {
    avant:       'En amont du projet',
    instruction: 'Instruction administrative',
    travaux:     'Phase travaux',
    reception:   'Reception & conformite',
    post:        'Post-chantier',
  };

  bodyEl.innerHTML = '';

  /* Barre de progression globale */
  var total  = etapes.length;
  var done   = etapes.filter(function(e){ return checklistEtats[e.id] === 'done'; }).length;
  var pct    = total > 0 ? Math.round(done / total * 100) : 0;

  var prog = document.createElement('div');
  prog.className = 'cl-progress-wrap';
  prog.innerHTML =
    '<div class="cl-progress-info">' +
      '<span>Avancement</span>' +
      '<span id="cl-pct-txt">' + done + '/' + total + ' etapes (' + pct + '%)</span>' +
    '</div>' +
    '<div class="cl-progress-bar"><div class="cl-progress-fill" id="cl-fill" style="width:' + pct + '%"></div></div>';
  bodyEl.appendChild(prog);

  /* Bouton reset */
  var reset = document.createElement('button');
  reset.className = 'btn-cl-reset';
  reset.innerHTML = '&#x21BA; Reinitialiser la checklist';
  reset.addEventListener('click', function(){ resetChecklist(etapes); });
  bodyEl.appendChild(reset);

  /* Une phase à la fois */
  phases.forEach(function(phase) {
    var etapesPhase = etapes.filter(function(e){ return e.phase === phase; });
    if (etapesPhase.length === 0) return;

    var phaseDiv = document.createElement('div');
    phaseDiv.className = 'cl-phase phase-' + phase;
    phaseDiv.innerHTML =
      '<div class="cl-phase-titre">' +
        '<div class="cl-phase-dot"></div>' +
        phaseLabels[phase] +
      '</div>';

    etapesPhase.forEach(function(etape) {
      phaseDiv.appendChild(creerItemChecklist(etape));
    });

    bodyEl.appendChild(phaseDiv);
  });
}

/* Crée un item de checklist */
function creerItemChecklist(etape) {
  var etat  = checklistEtats[etape.id] || '';
  var isDone    = etat === 'done';
  var isExpanded = etat === 'expanded' || etat === 'done';

  var item = document.createElement('div');
  item.className  = 'cl-item' + (isDone ? ' done' : '') + (isExpanded ? ' expanded' : '');
  item.dataset.id = etape.id;
  item.innerHTML  =
    '<div class="cl-checkbox">' + (isDone ? '&#x2713;' : '') + '</div>' +
    '<div class="cl-content">' +
      '<div class="cl-nom">' +
        '<span class="cl-ico">' + etape.ico + '</span>' +
        etape.label +
        (etape.oblig ? '<span class="cl-oblig">Obligatoire</span>' : '') +
      '</div>' +
      '<div class="cl-delai">&#x23F1; ' + etape.delai + '</div>' +
      '<div class="cl-desc">' + etape.desc + '</div>' +
    '</div>';

  /* Clic sur la case à cocher → marquer done */
  item.querySelector('.cl-checkbox').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleItemDone(etape.id, item);
  });

  /* Clic sur le contenu → déplier/replier la description */
  item.querySelector('.cl-content').addEventListener('click', function() {
    toggleItemExpand(etape.id, item);
  });

  return item;
}

/* Marque/démarque une étape comme faite */
function toggleItemDone(id, item) {
  var isDone = checklistEtats[id] === 'done';
  checklistEtats[id] = isDone ? '' : 'done';

  item.classList.toggle('done', !isDone);
  item.querySelector('.cl-checkbox').innerHTML = !isDone ? '&#x2713;' : '';

  majProgressChecklist();
}

/* Déplie/replie la description d'une étape */
function toggleItemExpand(id, item) {
  var isExpanded = item.classList.contains('expanded');
  item.classList.toggle('expanded', !isExpanded);
  if (checklistEtats[id] !== 'done') {
    checklistEtats[id] = isExpanded ? '' : 'expanded';
  }
}

/* Met à jour la barre de progression */
function majProgressChecklist() {
  var clKey  = A.sousType || '_default';
  var etapes = CHECKLISTS[clKey] || CHECKLISTS['_default'];
  var total  = etapes.length;
  var done   = etapes.filter(function(e){ return checklistEtats[e.id] === 'done'; }).length;
  var pct    = total > 0 ? Math.round(done / total * 100) : 0;

  var fill = document.getElementById('cl-fill');
  var txt  = document.getElementById('cl-pct-txt');
  if (fill) fill.style.width = pct + '%';
  if (txt)  txt.textContent  = done + '/' + total + ' etapes (' + pct + '%)';
}

/* Réinitialise toutes les cases */
function resetChecklist(etapes) {
  etapes.forEach(function(e){ delete checklistEtats[e.id]; });
  genererChecklist();
}

/* Hook lancerAnalyse pour afficher la checklist */
var _lancerAnalyseOrig = lancerAnalyse;
lancerAnalyse = function() {
  _lancerAnalyseOrig();
  afficherChecklist();
};

/* ════════════════════════════════════════════════════════════════════
   RECHERCHE D'ADRESSE — API Nominatim (OpenStreetMap)
   Nominatim est un service de geocodage gratuit et ouvert base sur
   les donnees OpenStreetMap. Aucune cle API n'est requise.
   URL : https://nominatim.openstreetmap.org/search

   Fonctionnement :
     1. L'utilisateur tape une adresse dans la barre de recherche.
     2. Apres 350 ms de pause (debounce), on interroge Nominatim.
     3. Les suggestions s'affichent sous la barre.
     4. Un clic ou Entree centre la carte sur le resultat et place
        un marqueur temporaire (qui disparait apres 8 s).
   ════════════════════════════════════════════════════════════════════ */

/* ── Etat de la recherche ──────────────────────────────────────── */
var recherche = {
  timer:          null,   /* debounce setTimeout */
  suggestions:    [],     /* resultats Nominatim courants */
  idxActif:       -1,     /* index de la suggestion selectionnee au clavier */
  marqueur:       null,   /* Leaflet marker du resultat */
  toastTimer:     null,   /* setTimeout pour masquer le toast */
};

/* ── Icones par type de resultat ───────────────────────────────── */
var SUGG_ICONS = {
  house:              '&#x1F3E0;',
  residential:        '&#x1F3D8;',
  road:               '&#x1F6E3;',
  pedestrian:         '&#x1F6B6;',
  city:               '&#x1F3D9;',
  town:               '&#x1F3D9;',
  village:            '&#x1F3E1;',
  hamlet:             '&#x1F3E1;',
  suburb:             '&#x1F3D8;',
  postcode:           '&#x1F4EE;',
  administrative:     '&#x1F3DB;',
  farm:               '&#x1F33E;',
  industrial:         '&#x1F3ED;',
  commercial:         '&#x1F6CD;',
  retail:             '&#x1F6CD;',
  school:             '&#x1F4DA;',
  hospital:           '&#x1F3E5;',
  park:               '&#x1F333;',
  forest:             '&#x1F332;',
  water:              '&#x1F30A;',
  _default:           '&#x1F4CD;',
};

/* Retourne l'icone en fonction du type Nominatim */
function getIconeSuggestion(type, classe) {
  return SUGG_ICONS[type] || SUGG_ICONS[classe] || SUGG_ICONS['_default'];
}

/* ── Debounce : declenche la recherche 350 ms apres la derniere frappe ── */
function onSearchInput() {
  var val  = document.getElementById('search-input').value.trim();
  var wrap = document.getElementById('search-wrap');

  /* Afficher/masquer le bouton clear */
  if (val.length > 0) {
    wrap.classList.add('has-value');
  } else {
    wrap.classList.remove('has-value');
    masquerSuggestions();
    return;
  }

  /* Debounce : on attend 350 ms avant d'envoyer la requete */
  clearTimeout(recherche.timer);
  recherche.timer = setTimeout(function() {
    if (val.length >= 2) fetchSuggestions(val);
  }, 350);
}

/* ── Navigation clavier dans les suggestions ──────────────────── */
function onSearchKey(event) {
  var liste = document.getElementById('search-suggestions');
  var items = liste.querySelectorAll('.sugg-item');

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    recherche.idxActif = Math.min(recherche.idxActif + 1, items.length - 1);
    majActiveSuggestion(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    recherche.idxActif = Math.max(recherche.idxActif - 1, -1);
    majActiveSuggestion(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (recherche.idxActif >= 0 && items[recherche.idxActif]) {
      /* Selectionner la suggestion active */
      var idx = parseInt(items[recherche.idxActif].dataset.idx);
      selectionnerSuggestion(recherche.suggestions[idx]);
    } else {
      /* Lancer la recherche directe */
      lancerRecherche();
    }
  } else if (event.key === 'Escape') {
    masquerSuggestions();
    document.getElementById('search-input').blur();
  }
}

/* Met en evidence la suggestion selectionnee au clavier */
function majActiveSuggestion(items) {
  items.forEach(function(item, i) {
    item.classList.toggle('actif', i === recherche.idxActif);
    if (i === recherche.idxActif) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

/* ── Requete Nominatim pour les suggestions ───────────────────── */
function fetchSuggestions(query) {
  var liste = document.getElementById('search-suggestions');

  /* Afficher le spinner de chargement */
  liste.innerHTML =
    '<li class="sugg-loading">' +
      '<div class="sugg-spinner"></div>' +
      'Recherche en cours...' +
    '</li>';
  liste.classList.remove('search-sugg-hidden');
  recherche.idxActif = -1;

  /* Construction de l'URL Nominatim
     - q         : la requete de l'utilisateur
     - countrycodes : restreint aux resultats en France
     - viewbox   : favorise les resultats dans le Territoire de Belfort
     - bounded   : 0 = utilise viewbox comme preference (pas stricte)
     - limit     : max 6 suggestions
     - format    : json
     - addressdetails : 1 pour avoir les details de l'adresse
  */
  var url =
    'https://nominatim.openstreetmap.org/search' +
    '?q=' + encodeURIComponent(query) +
    '&countrycodes=fr' +
    '&viewbox=6.5,47.9,7.2,47.4' +
    '&bounded=0' +
    '&limit=6' +
    '&format=json' +
    '&addressdetails=1';

  /* Nominatim requiert un User-Agent descriptif dans les headers */
  fetch(url, {
    headers: { 'Accept-Language': 'fr' }
  })
  .then(function(resp) {
    if (!resp.ok) throw new Error('Nominatim HTTP ' + resp.status);
    return resp.json();
  })
  .then(function(data) {
    recherche.suggestions = data;
    afficherSuggestions(data);
  })
  .catch(function(err) {
    console.warn('Nominatim error:', err);
    liste.innerHTML = '<li class="sugg-empty">&#x26A0; Impossible de joindre le service de recherche. Verifiez votre connexion.</li>';
  });
}

/* ── Affichage des suggestions dans la liste ──────────────────── */
function afficherSuggestions(data) {
  var liste = document.getElementById('search-suggestions');
  liste.innerHTML = '';

  if (data.length === 0) {
    liste.innerHTML = '<li class="sugg-empty">&#x1F50D; Aucun resultat pour cette adresse.</li>';
    liste.classList.remove('search-sugg-hidden');
    return;
  }

  data.forEach(function(item, idx) {
    var li = document.createElement('li');
    li.className    = 'sugg-item';
    li.dataset.idx  = idx;

    /* Nom principal : premiere partie de l'affichage */
    var nom    = item.name || (item.address && item.address.road) || item.display_name.split(',')[0];
    /* Detail : reste de l'adresse */
    var detail = item.display_name.replace(nom + ', ', '').replace(nom, '');

    var ico = getIconeSuggestion(item.type, item.class);

    li.innerHTML =
      '<span class="sugg-ico">' + ico + '</span>' +
      '<div class="sugg-content">' +
        '<div class="sugg-nom">' + nom + '</div>' +
        '<div class="sugg-detail">' + detail + '</div>' +
      '</div>';

    /* Clic sur une suggestion */
    li.addEventListener('mousedown', function(e) {
      e.preventDefault(); /* Eviter la perte de focus avant le clic */
      selectionnerSuggestion(item);
    });

    /* Survol : mise en evidence */
    li.addEventListener('mouseover', function() {
      recherche.idxActif = idx;
    });

    liste.appendChild(li);
  });

  liste.classList.remove('search-sugg-hidden');
}

/* ── Masquer la liste de suggestions ──────────────────────────── */
function masquerSuggestions() {
  var liste = document.getElementById('search-suggestions');
  liste.classList.add('search-sugg-hidden');
  liste.innerHTML = '';
  recherche.idxActif = -1;
}

/* ── Effacer le champ de recherche ────────────────────────────── */
function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-wrap').classList.remove('has-value');
  masquerSuggestions();
  /* Supprimer le marqueur de resultat si present */
  if (recherche.marqueur) {
    A.carte.removeLayer(recherche.marqueur);
    recherche.marqueur = null;
  }
  document.getElementById('search-input').focus();
}

/* ── Lancer une recherche (bouton ou Entree sans selection) ───── */
function lancerRecherche() {
  var query = document.getElementById('search-input').value.trim();
  if (!query) return;

  /* Si des suggestions sont disponibles, prendre la premiere */
  if (recherche.suggestions.length > 0) {
    selectionnerSuggestion(recherche.suggestions[0]);
  } else {
    /* Sinon, faire une requete directe sans suggestions */
    fetchEtNaviguer(query);
  }
}

/* Requete directe sans suggestions (Enter sans liste) */
function fetchEtNaviguer(query) {
  var url =
    'https://nominatim.openstreetmap.org/search' +
    '?q=' + encodeURIComponent(query) +
    '&countrycodes=fr' +
    '&limit=1' +
    '&format=json' +
    '&addressdetails=1';

  fetch(url, { headers: { 'Accept-Language': 'fr' } })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    if (data.length > 0) selectionnerSuggestion(data[0]);
    else afficherToast('&#x26A0; Adresse introuvable. Essayez une formulation plus precise.');
  })
  .catch(function() {
    afficherToast('&#x26A0; Erreur de connexion au service de recherche.');
  });
}

/* ── Selectionner un resultat : zoom + marqueur ───────────────── */
function selectionnerSuggestion(item) {
  masquerSuggestions();

  var lat = parseFloat(item.lat);
  var lng = parseFloat(item.lon);

  if (isNaN(lat) || isNaN(lng)) return;

  /* Mettre le nom dans le champ de saisie */
  var nom = item.name || item.display_name.split(',')[0];
  document.getElementById('search-input').value = nom;
  document.getElementById('search-wrap').classList.add('has-value');

  /* ── Centrer et zoomer la carte ── */
  /* Si Nominatim fournit une bounding box, on l'utilise pour fitBounds
     afin d'avoir un zoom adapte a la taille de l'objet
     (une rue vs une commune vs un departement). */
  if (item.boundingbox) {
    var bb = item.boundingbox;
    /* bb = [lat_min, lat_max, lng_min, lng_max] */
    A.carte.fitBounds([
      [parseFloat(bb[0]), parseFloat(bb[2])],
      [parseFloat(bb[1]), parseFloat(bb[3])],
    ], { maxZoom: 17, padding: [40, 40], animate: true, duration: 0.8 });
  } else {
    /* Fallback : zoom fixe */
    A.carte.setView([lat, lng], 16, { animate: true, duration: 0.8 });
  }

  /* ── Marqueur temporaire ── */
  /* Supprimer le marqueur precedent si il existe */
  if (recherche.marqueur) {
    A.carte.removeLayer(recherche.marqueur);
    recherche.marqueur = null;
  }

  /* Creer un marqueur HTML avec un design distinct (rouge avec pulsation) */
  var markerIcon = L.divIcon({
    className: '',
    html:
      '<div style="' +
        'position:relative;' +
        'width:22px; height:22px;' +
      '">' +
        /* Cercle pulsant */
        '<div style="' +
          'position:absolute; inset:0;' +
          'background: rgba(220,38,38,.25);' +
          'border-radius: 50%;' +
          'animation: pulse-search 1.8s ease-out infinite;' +
        '"></div>' +
        /* Point central */
        '<div style="' +
          'position:absolute; inset:4px;' +
          'background: #dc2626;' +
          'border-radius: 50%;' +
          'border: 2px solid #fff;' +
          'box-shadow: 0 1px 4px rgba(0,0,0,.3);' +
        '"></div>' +
      '</div>',
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  });

  /* Ajouter l'animation pulse dans le head si pas encore faite */
  if (!document.getElementById('search-pulse-style')) {
    var style = document.createElement('style');
    style.id  = 'search-pulse-style';
    style.textContent =
      '@keyframes pulse-search {' +
        '0%   { transform: scale(1);   opacity: .8; }' +
        '70%  { transform: scale(2.5); opacity: 0; }' +
        '100% { transform: scale(2.5); opacity: 0; }' +
      '}';
    document.head.appendChild(style);
  }

  recherche.marqueur = L.marker([lat, lng], { icon: markerIcon })
    .addTo(A.carte)
    .bindPopup(
      '<div style="font-family:\'Source Serif 4\',serif;min-width:180px;">' +
        '<div style="font-weight:600;font-size:.9rem;margin-bottom:4px;">' + nom + '</div>' +
        '<div style="font-size:.74rem;color:#6b7280;line-height:1.5;">' +
          item.display_name +
        '</div>' +
        '<div style="margin-top:8px;font-size:.72rem;color:#1540a8;">' +
          'Lat\u00a0' + lat.toFixed(5) + ' \u2014 Lng\u00a0' + lng.toFixed(5) +
        '</div>' +
        '<button onclick="placerProjetIci(' + lat + ',' + lng + ')" ' +
          'style="margin-top:8px;width:100%;padding:5px 8px;background:#002395;color:#fff;' +
          'border:none;border-radius:6px;font-size:.76rem;font-weight:600;cursor:pointer;">' +
          '&#x1F4CD; Placer le projet ici' +
        '</button>' +
      '</div>'
    )
    .openPopup();

  /* ── Toast de confirmation ── */
  afficherToast('&#x1F4CD;\u00a0 ' + nom);
}

/* ── Placer le projet directement depuis la popup du marqueur ─── */
function placerProjetIci(lat, lng) {
  if (!A.typeProjet) {
    afficherToast('&#x26A0; Selectionnez d\'abord un type de projet dans le panneau gauche.');
    return;
  }
  A.carte.closePopup();
  placerProjet(lat, lng);
  afficherToast('&#x2705;\u00a0 Projet place sur ' + document.getElementById('search-input').value);
}

/* ── Toast de confirmation (message flottant ephemere) ───────── */
function afficherToast(msg) {
  var toast = document.getElementById('search-toast');
  toast.innerHTML = msg;
  toast.classList.add('on');

  /* Masquer apres 3 secondes */
  clearTimeout(recherche.toastTimer);
  recherche.toastTimer = setTimeout(function() {
    toast.classList.remove('on');
  }, 3000);
}

/* ── Fermer les suggestions si on clique ailleurs ─────────────── */
document.addEventListener('click', function(e) {
  if (!document.getElementById('search-wrap').contains(e.target)) {
    masquerSuggestions();
  }
});

/* ════════════════════════════════════════════════════════════════════
   TUTORIEL D'ONBOARDING
   Affiché au premier chargement de la page (via localStorage).
   Composé de slides statiques + slides serious game interactif.
   ════════════════════════════════════════════════════════════════════ */

/* ── Données des slides ─────────────────────────────────────────── */
var TUTO_SLIDES = [

  /* ══ 0. Bienvenue ══ */
  {
    type: 'welcome',
    html: function() { return (
      '<div class="tuto-slide" style="text-align:center;">' +
        '<div class="tuto-badge">&#x1F3DB;&nbsp; DDT 90 &mdash; Territoire de Belfort</div>' +
        '<div class="tuto-hero">&#x1F5FA;&#xFE0F;</div>' +
        '<div class="tuto-title">Bienvenue sur le Logiciel Interactif d\'Aide a la Decision</div>' +
        '<div class="tuto-sub">Cet outil vous aide a prendre des decisions eclairees sur vos projets d\'amenagement en vous fournissant les enjeux territoriaux, les contacts utiles et les demarches administratives issus de l\'Atlas DDT 90 2025-2026.</div>' +
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px;">' +
          '<div style="background:var(--rf-pale);border:1px solid rgba(0,35,149,.12);border-radius:var(--r-lg);padding:10px 16px;font-size:.78rem;color:var(--rf);font-weight:500;text-align:center;">' +
            '&#x1F4CB; 49 fiches enjeux' +
          '</div>' +
          '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r-lg);padding:10px 16px;font-size:.78rem;color:#15803d;font-weight:500;text-align:center;">' +
            '&#x1F5FA; 11 couches Atlas' +
          '</div>' +
          '<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:var(--r-lg);padding:10px 16px;font-size:.78rem;color:#92400e;font-weight:500;text-align:center;">' +
            '&#x2705; Checklist administrative' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 1. La carte interactive ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x1F30D;</div>' +
        '<div class="tuto-title">La carte interactive</div>' +
        '<div class="tuto-sub">Le fond de carte du Territoire de Belfort est enrichi des 101 communes et de 11 couches thematiques issues de l\'Atlas DDT 90.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F50D;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Barre de recherche</div>' +
              '<div class="tuto-feat-desc">Tapez une adresse ou une commune dans la barre en haut. La carte zoome automatiquement sur le lieu recherche.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F4CD;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Placement du projet</div>' +
              '<div class="tuto-feat-desc">Cliquez sur "Placer le projet sur la carte" puis cliquez sur la carte pour positionner votre projet. Double-cliquez sur le marqueur pour le deplacer.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F3D9;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Survol des communes</div>' +
              '<div class="tuto-feat-desc">Passez la souris sur une commune pour afficher son nom, sa population, sa superficie et son code postal.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 2. Configurer votre projet ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x1F4CB;</div>' +
        '<div class="tuto-title">Configurer votre projet</div>' +
        '<div class="tuto-sub">Le panneau gauche vous permet de definir precisement votre projet avant l\'analyse.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">1&#xFE0F;&#x20E3;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Type de projet + sous-type</div>' +
              '<div class="tuto-feat-desc">Choisissez parmi 8 types (logement, ZAE, energie...) puis precisez via le menu secondaire qui apparait (ex : maison individuelle, centrale PV, elevage...).</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">2&#xFE0F;&#x20E3;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Superficie et localisation</div>' +
              '<div class="tuto-feat-desc">Renseignez la superficie (m&#178;, ha, km&#178;). L\'envergure reglementaire est suggeree automatiquement. Placez le projet sur la carte pour le contextualiser.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">4&#xFE0F;&#x20E3;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Couches thematiques Atlas</div>' +
              '<div class="tuto-feat-desc">Activez les 11 couches de l\'Atlas (risques, eau, biodiversite, urbanisme...) pour visualiser les enjeux directement sur la carte.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 3. Fiches enjeux ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x26A0;&#xFE0F;</div>' +
        '<div class="tuto-title">Les fiches enjeux</div>' +
        '<div class="tuto-sub">Apres avoir clique sur "Analyser les enjeux", le panneau droit affiche les enjeux pertinents pour votre projet, classes par niveau de priorite.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico" style="background:#fee2e2;padding:4px;border-radius:6px;">&#x26A0;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Niveaux de priorite</div>' +
              '<div class="tuto-feat-desc">Chaque enjeu est classe <strong style="color:#991b1b">Eleve</strong>, <strong style="color:#92400e">Moyen</strong> ou <strong style="color:#065f46">Faible</strong> selon l\'urgence reglementaire.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F5FA;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Liens vers l\'Atlas</div>' +
              '<div class="tuto-feat-desc">Chaque fiche affiche la reference a la carte de l\'Atlas DDT 90. Cliquez sur le lien pour ouvrir la fiche detaillee avec le contexte reglementaire complet.</div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F4DE;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Contacts + Checklist</div>' +
              '<div class="tuto-feat-desc">En bas du panneau : les contacts des acteurs du territoire filtes selon votre projet, et la checklist administrative avec toutes les etapes a suivre.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 4. Illiwap + concertation ══ */
  {
    type: 'feature',
    html: function() { return (
      '<div class="tuto-slide">' +
        '<div class="tuto-hero">&#x1F4AC;</div>' +
        '<div class="tuto-title">Concertation avec Illiwap</div>' +
        '<div class="tuto-sub">Pour tout projet, la concertation publique est une etape cle. L\'outil Illiwap facilite la creation de sondages en ligne adaptes aux projets d\'amenagement.</div>' +
        '<div class="tuto-features">' +
          '<div class="tuto-feat" style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fde68a;">' +
            '<span class="tuto-feat-ico">&#x1F4CA;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Illiwap — Sondages geolocalises</div>' +
              '<div class="tuto-feat-desc">Creez des questionnaires en ligne, diffusez-les par lien ou QR code. Les repondants n\'ont pas besoin de compte. Resultats exportables.<br/><a href="https://www.illiwap.com" target="_blank" rel="noopener" style="color:#b45309;font-weight:600;">&#x1F517; www.illiwap.com</a>&nbsp;&nbsp;<a href="https://www.illiwap.com/tutoriels" target="_blank" rel="noopener" style="color:#b45309;font-weight:600;">&#x1F393; Tutoriels</a></div>' +
            '</div>' +
          '</div>' +
          '<div class="tuto-feat">' +
            '<span class="tuto-feat-ico">&#x1F6E1;</span>' +
            '<div class="tuto-feat-body">' +
              '<div class="tuto-feat-titre">Retrouvez Illiwap dans les enjeux</div>' +
              '<div class="tuto-feat-desc">Chaque fiche "Prevention/Sensibilisation" contient un lien vers Illiwap et le tutoriel. Filtrez les enjeux avec le theme Prevention pour les afficher.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );},
  },

  /* ══ 5. Invitation serious game ══ */
  {
    type: 'sg-intro',
    html: function() { return (
      '<div class="tuto-slide" style="text-align:center;">' +
        '<div class="sg-intro-badge">&#x1F3AE;&nbsp; Mode optionnel &mdash; Serious Game</div>' +
        '<div class="tuto-hero">&#x1F9E0;</div>' +
        '<div class="tuto-title">Testez vos connaissances !</div>' +
        '<div class="tuto-sub">Un cas pratique en 5 questions pour valider votre comprehension des enjeux reglementaires du Territoire de Belfort. Optionnel &mdash; vous pouvez commencer a utiliser l\'outil maintenant.</div>' +
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;">' +
          '<button onclick="demarrerSeriousGame()" style="height:42px;padding:0 24px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.85rem;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(217,119,6,.35);">&#x1F3AE; Jouer au Serious Game</button>' +
          '<button onclick="fermerTutoriel()" style="height:42px;padding:0 24px;background:var(--rf);color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.85rem;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(0,35,149,.3);">&#x1F680; Commencer a utiliser l\'outil</button>' +
        '</div>' +
      '</div>'
    );},
  },
];

/* ── Cas du serious game ────────────────────────────────────────── */
var SG_CAS = {
  titre:       'Projet de lotissement — Commune de Cravanche',
  description: 'La commune de Cravanche (90200) souhaite autoriser la creation d\'un lotissement de 15 maisons individuelles sur un terrain de 2,8 ha situe en bordure de la Savoureuse, en zone UB du PLU communal. Le maire vous consulte avant de donner son accord de principe.',
  meta: ['15 logements', '2,8 ha', 'Zone UB', 'Bordure Savoureuse'],
  scenario_ico: '&#x1F3D8;',
};

var SG_QUESTIONS = [
  {
    q: 'Quelle est la PREMIERE verification a effectuer avant d\'autoriser ce projet ?',
    opts: [
      { txt: 'Verifier que le terrain est bien en zone UB du PLU', correct: false },
      { txt: 'Consulter le PPRi de la Savoureuse pour verifier si le terrain est en zone inondable', correct: true },
      { txt: 'Demander une etude de marche pour verifier le besoin en logements', correct: false },
      { txt: 'Contacter Enedis pour le raccordement electrique', correct: false },
    ],
    feedback_ok: '&#x2705; Correct ! La Savoureuse est soumise au PPRi. 85 communes du 90 sont en zone inondable. Un terrain en zone rouge du PPRi interdit toute construction. Cette verification est absolument prioritaire.',
    feedback_ko: '&#x274C; Pas tout a fait. Certes, le zonage PLU est important, mais la proximite de la Savoureuse impose de verifier le PPRi en tout premier lieu. Un terrain en zone rouge PPRi ne peut pas etre construit, quels que soient les autres elements.',
  },
  {
    q: 'Le terrain est classe en zone bleue du PPRi. Quelle autorisation d\'urbanisme est necesssaire pour ce lotissement de 15 lots ?',
    opts: [
      { txt: 'Un Permis de Construire (PC) pour chaque maison', correct: false },
      { txt: 'Une Declaration Prealable (DP)', correct: false },
      { txt: 'Un Permis d\'Amenager (PA) obligatoire pour tout lotissement de plus de 2 lots', correct: true },
      { txt: 'Aucune autorisation car la commune a un PLU', correct: false },
    ],
    feedback_ok: '&#x2705; Exact ! Un lotissement creant plus de 2 lots constructibles destines a l\'implantation de batiments necessite un Permis d\'Amenager (PA). Le PA est distinct des PC que chaque acquereur devra deposer ensuite.',
    feedback_ko: '&#x274C; Incorrect. Pour un lotissement de plus de 2 lots, c\'est un Permis d\'Amenager (PA) qui est requis, pas un PC. Le PA est instruit par la DDT 90 (commune hors PLU) ou la mairie (commune avec PLU).',
  },
  {
    q: 'Le projet est situe a 80 m de la Citadelle de Belfort (Monument Historique classe). Qui doit obligatoirement etre consulte ?',
    opts: [
      { txt: 'La DREAL Bourgogne-Franche-Comte', correct: false },
      { txt: 'L\'Architecte des Batiments de France (ABF) de l\'UDAP 90', correct: true },
      { txt: 'Le Conseil Departemental du Territoire de Belfort', correct: false },
      { txt: 'Aucune consultation supplementaire n\'est requise', correct: false },
    ],
    feedback_ok: '&#x2705; Parfait ! Dans le perimetre de protection de 500 m autour d\'un Monument Historique, l\'avis de l\'Architecte des Batiments de France (ABF) de l\'UDAP 90 est OBLIGATOIRE et CONFORME. Son accord est necessaire pour que le permis soit delivre.',
    feedback_ko: '&#x274C; Non. Dans le perimetre de 500 m autour d\'un Monument Historique, c\'est l\'Architecte des Batiments de France (ABF) de l\'UDAP 90 qui doit etre consulte. Son avis est conforme : sans son accord, le permis ne peut pas etre delivre.',
  },
  {
    q: 'Pour la gestion des eaux pluviales du lotissement, quelle approche est prioritaire selon la loi ZAN et la reglementation eau ?',
    opts: [
      { txt: 'Raccordement systematique au reseau pluvial municipal', correct: false },
      { txt: 'Rejet direct dans la Savoureuse apres traitement', correct: false },
      { txt: 'Gestion des eaux pluviales a la parcelle : noues, jardins de pluie, toitures vegetalisees', correct: true },
      { txt: 'Construction d\'un bassin de retenue collectif unique en bout de lotissement', correct: false },
    ],
    feedback_ok: '&#x2705; Excellent ! La gestion a la source (noues, toitures vegetalisees, jardins de pluie) est privilegiee car elle limite l\'impermeabilisation, contribue a la biodiversite et reduit le ruissellement vers la Savoureuse. La loi sur l\'eau (IOTA) peut necessiter une declaration ou autorisation.',
    feedback_ko: '&#x274C; Pas tout a fait. La gestion a la source — noues, toitures vegetalisees, jardins de pluie — est prioritaire car elle limite l\'impermeabilisation des sols et reduit le risque de ruissellement. Un bassin collectif peut etre complementaire mais ne doit pas etre la seule solution.',
  },
  {
    q: 'Avec 15 lots vendus a des particuliers, la commune est-elle soumise aux obligations de la loi SRU sur le logement social ?',
    opts: [
      { txt: 'Oui, toujours pour tout projet de plus de 5 logements', correct: false },
      { txt: 'Non, la loi SRU ne s\'applique pas aux communes de moins de 3 500 habitants', correct: true },
      { txt: 'Oui, 25% des logements doivent etre sociaux quelle que soit la taille de la commune', correct: false },
      { txt: 'Seulement si la commune est dans GBCA', correct: false },
    ],
    feedback_ok: '&#x2705; Correct ! La loi SRU (25% de logements sociaux) ne s\'applique qu\'aux communes de plus de 3 500 habitants appartenant a des agglomérations ou intercommunalites de plus de 50 000 habitants. Cravanche (~1 400 hab.) n\'est pas concernee.',
    feedback_ko: '&#x274C; Pas tout a fait. La loi SRU (25% de logements sociaux obligatoires) ne concerne que les communes de plus de 3 500 habitants dans des intercommunalites de plus de 50 000 habitants. Cravanche (~1 400 hab.) est exempte de cette obligation.',
  },
];

/* ── Etat du tutoriel et du serious game ───────────────────────── */
var tuto = {
  slide:       0,
  total:       TUTO_SLIDES.length,
  sgActif:     false,
  sgQuestion:  0,
  sgScore:     0,
  sgReponses:  [],  /* { correct: bool, idx: int } par question */
};

/* ── Initialisation au chargement ─────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  /* Afficher le tutoriel seulement si pas deja vu
     On utilise localStorage pour persister l'etat entre sessions */
  var deja_vu = false;
  try { deja_vu = localStorage.getItem('ddt90_tuto_done') === '1'; } catch(e) {}
  if (!deja_vu) {
    afficherTutoriel();
  }
});

/* ── Afficher le tutoriel ──────────────────────────────────────── */
function afficherTutoriel() {
  tuto.slide   = 0;
  tuto.sgActif = false;
  var overlay = document.getElementById('tuto-overlay');
  overlay.classList.remove('hidden');
  renderSlide();
}

/* ── Fermer le tutoriel ────────────────────────────────────────── */
function fermerTutoriel() {
  var overlay = document.getElementById('tuto-overlay');
  overlay.classList.add('hidden');
  try { localStorage.setItem('ddt90_tuto_done', '1'); } catch(e) {}
}

/* ── Navigation dans le tutoriel ──────────────────────────────── */
function tutoNav(dir) {
  if (tuto.sgActif) return;  /* Le SG gere sa propre navigation */

  tuto.slide = Math.max(0, Math.min(tuto.total - 1, tuto.slide + dir));

  /* Sur la derniere slide du tuto (SG intro) et avancer = fermer */
  if (dir === 1 && tuto.slide === tuto.total - 1) {
    /* Deja sur la slide SG intro — rien, l'utilisateur choisit */
  }
  renderSlide();
}

/* ── Rend la slide courante ────────────────────────────────────── */
function renderSlide() {
  var slide   = TUTO_SLIDES[tuto.slide];
  var content = document.getElementById('tuto-content');
  var dots    = document.getElementById('tuto-dots');
  var prev    = document.getElementById('tuto-prev');
  var next    = document.getElementById('tuto-next');
  var fill    = document.getElementById('tuto-progress-fill');

  /* Contenu */
  content.innerHTML = slide.html();

  /* Barre de progression */
  var pct = Math.round((tuto.slide + 1) / tuto.total * 100);
  fill.style.width = pct + '%';

  /* Dots */
  dots.innerHTML = '';
  TUTO_SLIDES.forEach(function(_, i) {
    var d = document.createElement('div');
    d.className = 'tuto-dot' + (i === tuto.slide ? ' actif' : '');
    d.addEventListener('click', function() { tuto.slide = i; renderSlide(); });
    dots.appendChild(d);
  });

  /* Boutons nav */
  prev.classList.toggle('hidden-nav', tuto.slide === 0);
  if (tuto.slide === tuto.total - 1) {
    next.style.display = 'none';   /* Sur la slide SG intro, les boutons sont dans le contenu */
  } else {
    next.style.display = '';
    next.textContent = tuto.slide === tuto.total - 2
      ? 'Suivant \u2192'
      : 'Suivant \u2192';
  }
}

/* ════════════════════════════════════════════════════════════════════
   SERIOUS GAME
   ════════════════════════════════════════════════════════════════════ */

function demarrerSeriousGame() {
  tuto.sgActif    = true;
  tuto.sgQuestion = 0;
  tuto.sgScore    = 0;
  tuto.sgReponses = [];

  /* Masquer les boutons de navigation standard */
  document.getElementById('tuto-prev').classList.add('hidden-nav');
  document.getElementById('tuto-next').style.display = 'none';
  document.getElementById('tuto-skip').textContent = 'Quitter le jeu \u2715';
  document.getElementById('tuto-progress-fill').style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';

  renderQuestionSG();
}

/* Rend la question courante */
function renderQuestionSG() {
  var content = document.getElementById('tuto-content');
  var fill    = document.getElementById('tuto-progress-fill');
  var dots    = document.getElementById('tuto-dots');

  var q   = SG_QUESTIONS[tuto.sgQuestion];
  var num = tuto.sgQuestion + 1;
  var tot = SG_QUESTIONS.length;

  /* Progression */
  fill.style.width = Math.round((num / tot) * 100) + '%';

  /* Dots pour les questions */
  dots.innerHTML = '';
  SG_QUESTIONS.forEach(function(_, i) {
    var d = document.createElement('div');
    d.className = 'tuto-dot' + (i === tuto.sgQuestion ? ' actif' : '');
    dots.appendChild(d);
  });

  /* Lettres des options */
  var lettres = ['A', 'B', 'C', 'D'];

  var optsHtml = q.opts.map(function(opt, i) {
    return (
      '<button class="sg-option" onclick="repondreSG(' + i + ', this)">' +
        '<div class="sg-option-lettre">' + lettres[i] + '</div>' +
        opt.txt +
      '</button>'
    );
  }).join('');

  content.innerHTML =
    '<div class="tuto-slide">' +
      '<div style="font-size:.72rem;font-weight:600;color:var(--ink-4);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">&#x1F3AE; Question ' + num + '/' + tot + '</div>' +
      '<div class="sg-scenario-card">' +
        '<div class="sg-scenario-titre">' + SG_CAS.scenario_ico + '&nbsp; ' + SG_CAS.titre + '</div>' +
        '<div class="sg-scenario-desc">' + SG_CAS.description + '</div>' +
        '<div class="sg-scenario-meta">' +
          SG_CAS.meta.map(function(m){ return '<span class="sg-meta-chip">' + m + '</span>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="sg-question">' + q.q + '</div>' +
      '<div class="sg-options">' + optsHtml + '</div>' +
      '<div class="sg-feedback" id="sg-feedback"></div>' +
    '</div>';
}

/* Gere une reponse */
function repondreSG(idx, btn) {
  var q       = SG_QUESTIONS[tuto.sgQuestion];
  var correct = q.opts[idx].correct;
  var lettres = ['A', 'B', 'C', 'D'];

  /* Bloquer toutes les options */
  var options = document.querySelectorAll('.sg-option');
  options.forEach(function(opt, i) {
    opt.classList.add('desactivee');
    if (q.opts[i].correct) opt.classList.add('correcte');
  });
  if (!correct) btn.classList.add('incorrecte');

  /* Mettre a jour le score */
  if (correct) tuto.sgScore++;
  tuto.sgReponses.push({ correct: correct, idx: idx });

  /* Afficher le feedback */
  var fb = document.getElementById('sg-feedback');
  fb.classList.add('on', correct ? 'ok' : 'ko');
  fb.innerHTML =
    '<div class="sg-feedback-titre">' + (correct ? '&#x2705; Bonne reponse !' : '&#x274C; Pas tout a fait...') + '</div>' +
    (correct ? q.feedback_ok : q.feedback_ko);

  /* Bouton suivant */
  var nav = document.createElement('div');
  nav.style.cssText = 'display:flex;justify-content:flex-end;margin-top:12px;';

  var btnSuivant = document.createElement('button');
  var estDerniere = tuto.sgQuestion === SG_QUESTIONS.length - 1;
  btnSuivant.textContent  = estDerniere ? '&#x1F3C6; Voir les resultats' : 'Question suivante \u2192';
  btnSuivant.style.cssText =
    'height:38px;padding:0 20px;background:' + (estDerniere ? 'var(--rf)' : '#065f46') + ';' +
    'color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.82rem;' +
    'font-weight:600;cursor:pointer;';
  btnSuivant.innerHTML = estDerniere
    ? '&#x1F3C6; Voir les resultats'
    : 'Question suivante &nbsp;&#x2192;';
  btnSuivant.addEventListener('click', function() {
    if (estDerniere) {
      afficherScoreSG();
    } else {
      tuto.sgQuestion++;
      renderQuestionSG();
    }
  });

  nav.appendChild(btnSuivant);
  fb.appendChild(nav);
}

/* Affiche le score final */
function afficherScoreSG() {
  var content = document.getElementById('tuto-content');
  var fill    = document.getElementById('tuto-progress-fill');
  var dots    = document.getElementById('tuto-dots');
  fill.style.width = '100%';
  dots.innerHTML   = '';

  var score = tuto.sgScore;
  var total = SG_QUESTIONS.length;
  var pct   = Math.round(score / total * 100);

  var cls, msg, desc;
  if (pct >= 80) {
    cls  = 'excellent';
    msg  = '&#x1F3C6; Excellent ! Vous maîtrisez les enjeux reglementaires du 90.';
    desc = 'Vous etes pret(e) a utiliser le logiciel d\'aide a la decision. Toutes les informations sont egalement disponibles dans les fiches enjeux et la checklist.';
  } else if (pct >= 50) {
    cls  = 'bien';
    msg  = '&#x1F44D; Bien ! Quelques points a revoir.';
    desc = 'Consultez les fiches enjeux des themes que vous maitrisez moins (risques naturels, urbanisme) apres avoir configure votre projet.';
  } else {
    cls  = 'peut-mieux';
    msg  = '&#x1F4DA; A retravailler ! Les fiches enjeux sont la pour vous aider.';
    desc = 'Pas d\'inquietude : les fiches enjeux, les contacts et la checklist du logiciel vous guideront pas a pas dans vos projets.';
  }

  /* Bilan des reponses */
  var bilanHtml = SG_QUESTIONS.map(function(q, i) {
    var rep = tuto.sgReponses[i];
    var ico = rep && rep.correct ? '&#x2705;' : '&#x274C;';
    return '<div style="display:flex;align-items:center;gap:8px;font-size:.76rem;color:var(--ink-3);padding:4px 0;border-bottom:1px solid var(--border);">' +
      '<span>' + ico + '</span>' +
      '<span>' + (i + 1) + '. ' + q.q.substring(0, 60) + '...</span>' +
    '</div>';
  }).join('');

  content.innerHTML =
    '<div class="tuto-slide" style="text-align:center;">' +
      '<div class="sg-score-ring ' + cls + '">' +
        '<div class="sg-score-num">' + score + '</div>' +
        '<div class="sg-score-denom">/' + total + '</div>' +
      '</div>' +
      '<div class="sg-score-msg">' + msg + '</div>' +
      '<div class="sg-score-detail" style="margin-bottom:16px;">' + desc + '</div>' +
      '<div style="text-align:left;width:100%;background:var(--bg);border-radius:var(--r-lg);padding:12px 14px;margin-bottom:16px;">' +
        '<div style="font-size:.72rem;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Votre bilan</div>' +
        bilanHtml +
      '</div>' +
      '<button onclick="fermerTutoriel()" style="height:42px;padding:0 28px;background:var(--rf);color:#fff;border:none;border-radius:20px;font-family:var(--f-ui);font-size:.88rem;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(0,35,149,.3);">&#x1F680; Commencer a utiliser l\'outil</button>' +
      '<br/><button onclick="afficherTutoriel()" style="margin-top:8px;background:none;border:none;color:var(--ink-4);font-size:.75rem;cursor:pointer;text-decoration:underline;">Rejouer le serious game</button>' +
    '</div>';
    /**
 * Alterne entre le mode clair et le mode sombre
 */
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  const icon = document.getElementById('dark-mode-icon');
  
  // Changement de l'icône
  icon.innerText = isDark ? '☀️' : '🌙';
  
  // Sauvegarde de la préférence
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/**
 * Initialisation du thème au chargement (à mettre dans votre fonction init)
 */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('dark-mode-icon').innerText = '☀️';
  }
}

// Appelez initTheme() au démarrage de votre script
window.addEventListener('DOMContentLoaded', initTheme);
}
