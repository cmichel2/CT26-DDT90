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
  /* Couleur, fill, label, swatch + tooltip explicatif de ce que la couche affiche */
  organisation: {
    color: '#1d4ed8', fill: '#60a5fa', swatch: '#3b82f6',
    label: 'Organisation du territoire',
    tooltip: 'Affiche les 101 communes du Territoire de Belfort avec leurs limites administratives, les 3 EPCI (GBCA, CCVS, CCST), les cantons et la carte des zones d\'emploi. Utile pour situer le projet dans son contexte institutionnel.',
  },
  population: {
    color: '#7c3aed', fill: '#c084fc', swatch: '#a855f7',
    label: 'Population & Economie',
    tooltip: 'Visualise la densité de population par commune, la pyramide des âges, les zones d\'emploi et les établissements économiques majeurs (Alstom, GE, PSA...). Indique la pression démographique et les bassins d\'emploi autour du projet.',
  },
  energie: {
    color: '#b45309', fill: '#fb923c', swatch: '#f97316',
    label: 'Energies renouvelables & Climat',
    tooltip: 'Montre le potentiel solaire des toitures (cadastre solaire), les installations ENR existantes (PV, éolien, biomasse), les zones favorables à l\'éolien et les objectifs SRADDET BFC. Essentiel pour les projets de production d\'énergie.',
  },
  agriculture: {
    color: '#15803d', fill: '#86efac', swatch: '#22c55e',
    label: 'Agriculture & PAC',
    tooltip: 'Affiche les parcelles agricoles (RPG-PAC), les zones vulnérables aux nitrates, les appellations et labels agricoles, et les surfaces de prairies permanentes. Obligatoire pour tout projet consommant du foncier agricole (CDPENAF).',
  },
  eau: {
    color: '#0369a1', fill: '#38bdf8', swatch: '#0ea5e9',
    label: 'Eau, cours d\'eau & SAGE',
    tooltip: 'Trace les cours d\'eau (Savoureuse, Bourbeuse, Allaine, Allan), les zones humides probables, les périmètres de captages AEP, le périmètre du SAGE Allan et les zones vulnérables nitrates. Crucial pour les dossiers Loi sur l\'eau (IOTA).',
  },
  biodiversite: {
    color: '#065f46', fill: '#6ee7b7', swatch: '#10b981',
    label: 'Biodiversite & Foret',
    tooltip: 'Localise les zones Natura 2000 (ZSC, ZPS), les ZNIEFF type I et II, les réservoirs et corridors de la Trame Verte et Bleue, la forêt du massif vosgien et le Grand Site Ballon d\'Alsace. Déclenche l\'évaluation d\'incidences Natura 2000.',
  },
  risques: {
    color: '#b91c1c', fill: '#fca5a5', swatch: '#ef4444',
    label: 'Risques naturels & DDRM',
    tooltip: 'Superpose les PPRi (inondation Savoureuse/Bourbeuse/Allaine), les zones de sismicité 2 et 3, l\'aléa retrait-gonflement des argiles, les zones de risque minier (mine de Giromagny), l\'aléa feux de forêt et le potentiel radon. Consulter avant tout PC.',
  },
  urbanisme: {
    color: '#6d28d9', fill: '#ddd6fe', swatch: '#8b5cf6',
    label: 'Urbanisme & Amenagement',
    tooltip: 'Affiche les zonages PLU/PLUi (U, AU, A, N) des communes, les périmètres SCoT du Territoire de Belfort, les zones AU ouvertes à l\'urbanisation et les secteurs de projet. Indispensable pour vérifier la constructibilité d\'une parcelle.',
  },
  habitat: {
    color: '#be185d', fill: '#f9a8d4', swatch: '#ec4899',
    label: 'Habitat & Logement',
    tooltip: 'Cartographie les Quartiers Prioritaires de la Ville (QPV), les secteurs d\'Action Cœur de Ville (Belfort), les programmes ANRU, le parc de logements sociaux et les friches urbaines inventoriées (portail BIGAN DDT 90).',
  },
  mobilite: {
    color: '#c2410c', fill: '#fdba74', swatch: '#f97316',
    label: 'Mobilites & Securite routiere',
    tooltip: 'Représente le réseau routier avec les flux de trafic (TMJA), les axes à fort trafic (>20 000 veh/j), le classement sonore des voiries, les axes TCSP et vélo, et les points noirs d\'accidentalité. Utile pour les projets générateurs de trafic.',
  },
  patrimoine: {
    color: '#78350f', fill: '#d97706', swatch: '#b45309',
    label: 'Patrimoine & Archeologie',
    tooltip: 'Matérialise les Monuments Historiques classés et inscrits avec leur périmètre de 500 m, les ZPPA (zones de présomption archéologique), les AVAP, les sites inscrits/classés et le périmètre Citadelle Vauban. Déclenche l\'avis ABF obligatoire.',
  },
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
  initTheme();

  /* Tutoriel : affiche si jamais vu (localStorage) */
  var dejaVu = false;
  try { dejaVu = localStorage.getItem('ddt90_tuto_v3') === '1'; } catch(e) {}
  if (!dejaVu) {
    setTimeout(afficherTutoriel, 80);
  }
});

/* ════════════════════════════════════════════════════════════════════
   CARTE LEAFLET
   ════════════════════════════════════════════════════════════════════ */

/* Initialise la carte Leaflet, le fond OSM, les communes et les marqueurs de villes. */
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

/* Retourne le style Leaflet par défaut pour les polygones communes. */
function styleCommuneDefaut() {
  return { color: '#002395', weight: 1, opacity: 0.45, fillColor: '#002395', fillOpacity: 0.04 };
}

/* Ajoute des marqueurs fixes pour Belfort, Delle et Grandvillars. */
function ajouterMarqueursPrincipaux() {
  /* Marqueur discret pour le chef-lieu uniquement — sans markers de villes */
  ajouterMarqueur(47.637, 6.863, '#002395', 7, '<b>Belfort</b><br/>Chef-lieu &mdash; DDT 90');
}

/* Ajoute un CircleMarker léger (repère de ville) avec une popup. */
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

/**
 * Place ou déplace le marqueur projet.
 * Met à jour A.position, dessine le cercle de superficie,
 * affiche le panneau actions et lance un toast de confirmation.
 */
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

  /* Masquer l'avertissement de placement si visible */
  var msgReq = document.getElementById('placement-requis');
  if (msgReq) msgReq.classList.remove('on');
  var btnPl = document.getElementById('btn-placer');
  if (btnPl) btnPl.style.boxShadow = '';
}

/**
 * Supprime le marqueur, réinitialise A.position et masque
 * toutes les sections de résultats (contacts, checklist, alentours).
 */
function supprimerProjet() {
  if (A.layerProjet) { A.carte.removeLayer(A.layerProjet); A.layerProjet = null; }
  if (A.layerCercle) { A.carte.removeLayer(A.layerCercle); A.layerCercle = null; }
  A.position = null;
  document.getElementById('pos-info').classList.remove('on');
  document.getElementById('btn-suppr').classList.remove('on');
  document.getElementById('leg-projet').style.display = 'none';
  desactiverDeplace();
  /* Masquer les sections de résultats */
  ['section-contacts','section-checklist','section-alentours'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  /* Nettoyer la couche alentours OSM */
  if (typeof alentours !== 'undefined' && alentours.layer) {
    A.carte.removeLayer(alentours.layer);
    alentours.layer = null;
    alentours.resultats = [];
  }
}

/* ── Mode placement (simple clic) ──────────────────────────────── */
function togglePlacement() {
  if (A.modePlacement) { desactiverPlacement(); } else { activerPlacement(); }
}

/* Active le mode clic-pour-placer : curseur crosshair + mise à jour du bouton. */
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

/* Désactive le mode placement et restaure l'apparence du bouton. */
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

/* Désactive le mode double-clic-pour-déplacer. */
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
    btn.className  = 'layer-toggle';
    btn.dataset.id = themeId;
    btn.innerHTML =
      '<span class="layer-swatch" style="background:' + style.swatch + ';"></span>' +
      '<span class="layer-label">' + style.label + '</span>' +
      (style.tooltip
        ? '<span class="layer-info" data-tooltip="' + style.tooltip.replace(/"/g, '&quot;') + '" aria-label="En savoir plus">?</span>'
        : '') +
      '<span class="layer-check">\u2713</span>';

    /* Clic : activer/désactiver la couche sauf si clic sur le ? */
    btn.addEventListener('click', function(e) {
      if (e.target.closest('.layer-info')) return;
      toggleCouche(themeId, btn);
    });

    conteneur.appendChild(btn);
  });

  /* ── Tooltip fixe : échappe l'overflow:hidden du panneau gauche ── */
  var tipEl = document.getElementById('layer-tooltip-global');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'layer-tooltip-global';
    tipEl.className = 'layer-tooltip-bubble';
    document.body.appendChild(tipEl);
  }

  conteneur.addEventListener('mouseover', function(e) {
    var info = e.target.closest('.layer-info');
    if (!info) return;
    tipEl.textContent = info.dataset.tooltip || '';
    var rect = info.getBoundingClientRect();
    var top  = rect.top + rect.height / 2;
    var left = rect.right + 10;
    /* Si la bulle déborde à droite, la placer à gauche du ? */
    if (left + 248 > window.innerWidth) {
      left = rect.left - 248 - 10;
      tipEl.classList.add('tip-left');
    } else {
      tipEl.classList.remove('tip-left');
    }
    tipEl.style.top  = top + 'px';
    tipEl.style.left = left + 'px';
    tipEl.classList.add('visible');
  });

  conteneur.addEventListener('mouseout', function(e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('.layer-info')) {
      tipEl.classList.remove('visible');
    }
  });
}

/**
 * Active ou désactive une couche thématique Atlas sur la carte.
 * @param {string}      themeId  Clé dans COUCHE_STYLES et COUCHES_DATA
 * @param {HTMLElement} btn      Bouton cliqué (classe "active" basculée)
 */
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

/**
 * Charge la couche GeoJSON depuis COUCHES_DATA et l'ajoute à la carte.
 * Sans effet si déjà chargée.
 */
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

/**
 * Recalcule A.superficieHa depuis le champ de saisie et l'unité sélectionnée,
 * puis redessine le cercle sur la carte si un projet est déjà placé.
 */
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

/* Génère les 8 boutons de type de projet dans #grille-types. */
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

/**
 * Sélectionne un type de projet, met à jour A.typeProjet, affiche le badge
 * dans le header, réinitialise le sous-type et rafraîchit les sous-types.
 */
function selType(btn) {
  document.querySelectorAll('.btn-type').forEach(function(b){ b.classList.remove('actif'); });
  btn.classList.add('actif');
  A.typeProjet = btn.dataset.type;
  var t = TYPES.find(function(x){ return x.id === A.typeProjet; });
  if (t) {
    document.getElementById('hdr-badge-txt').innerHTML = t.ico + '&nbsp;' + t.label;
    document.getElementById('hdr-badge').style.display = 'flex';
  }
  /* Réinitialiser le sous-type et afficher les sous-types du nouveau type */
  A.sousType = null;
  document.getElementById('stype-desc').classList.remove('on');
  afficherSousTypes(A.typeProjet);
}

/**
 * Met à jour A.taille (1–4) depuis le slider et affiche le nom
 * et la description de l'envergure réglementaire correspondante.
 */
function majTaille(val) {
  A.taille = parseInt(val);
  var t = TAILLES[A.taille];
  document.getElementById('taille-nom').textContent  = t.nom;
  document.getElementById('taille-desc').textContent = t.desc;
  document.getElementById('slider-taille').value = A.taille;
}

/* Génère les 4 badges de filtre thématique dans #grille-themes. */
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
   RENDU DES ENJEUX — 4 accordéons thématiques
   ════════════════════════════════════════════════════════════════════ */

/* Méta constante des 4 axes (couleurs, icônes, labels) */
var AXES_META = {
  environnement: {
    label: 'Environnement',
    ico:   '\uD83C\uDF33',   /* 🌳 */
    color: '#15803d',
    bg:    '#f0fdf4',
    border:'#86efac',
    dark_bg: '#052e16',
  },
  economique: {
    label: 'Economique',
    ico:   '\uD83D\uDCB0',   /* 💰 */
    color: '#7c3aed',
    bg:    '#f5f3ff',
    border:'#c4b5fd',
    dark_bg: '#1e1b4b',
  },
  politique: {
    label: 'Politique',
    ico:   '\uD83C\uDFDB',   /* 🏛 */
    color: '#92400e',
    bg:    '#fef9c3',
    border:'#fde68a',
    dark_bg: '#1c1006',
  },
  social: {
    label: 'Social',
    ico:   '\uD83D\uDC65',   /* 👥 */
    color: '#be123c',
    bg:    '#fff1f2',
    border:'#fda4af',
    dark_bg: '#1f0010',
  },
};

/* ── Construit les 4 accordéons après analyse ── */
function rendreAccordeons(filtres, conteneur) {
  /* NE PAS réinitialiser conteneur.innerHTML — l'accordéon zones
     est déjà inséré par rendreAccordeonZones, on ajoute après lui. */

  var axeIds = ['environnement', 'economique', 'politique', 'social'];
  var niveaux = { eleve: 'Elev\u00e9', moyen: 'Moyen', faible: 'Faible' };

  axeIds.forEach(function(axeId, idx) {
    var meta = AXES_META[axeId];

    /* Collecter tous les items pour cet axe */
    var items = [];
    filtres.forEach(function(enjeu) {
      var axe = enjeu.axes && enjeu.axes[axeId];
      if (!axe) return;
      items.push({ enjeu: enjeu, axe: axe });
    });

    if (items.length === 0) return;

    /* Wrapper accordéon */
    var accord = document.createElement('div');
    accord.className = 'accord-wrap';
    accord.dataset.axe = axeId;

    /* Bouton header */
    var btn = document.createElement('button');
    btn.className = 'accord-btn';
    btn.style.setProperty('--axe-color', meta.color);
    btn.style.setProperty('--axe-border', meta.border);
    btn.innerHTML =
      '<span class="accord-ico">' + meta.ico + '</span>' +
      '<span class="accord-label">' + meta.label + '</span>' +
      '<span class="accord-count">' + items.length + ' sujet' + (items.length > 1 ? 's' : '') + '</span>' +
      '<span class="accord-chev">&#x25BC;</span>';

    /* Corps dépliable */
    var body = document.createElement('div');
    body.className = 'accord-body';

    /* Ouvrir le premier accordéon par défaut */
    if (idx === 0) {
      accord.classList.add('ouvert');
    }

    /* Chaque enjeu = une fiche dans l'accordéon */
    items.forEach(function(item) {
      var enjeu = item.enjeu;
      var axe   = item.axe;

      var fiche = document.createElement('div');
      fiche.className = 'axe-fiche';

      /* En-tête de la fiche */
      var ficheHead = document.createElement('div');
      ficheHead.className = 'axe-fiche-head';
      ficheHead.innerHTML =
        '<span class="axe-fiche-ico">' + (enjeu.ico || '&#x26A0;') + '</span>' +
        '<span class="axe-fiche-nom">' + enjeu.nom + '</span>' +
        '<span class="niv-badge n-' + enjeu.niv + '">' + (niveaux[enjeu.niv] || enjeu.niv) + '</span>' +
        '<span class="axe-fiche-chev">&#x25BA;</span>';

      /* Corps de la fiche */
      var ficheBody = document.createElement('div');
      ficheBody.className = 'axe-fiche-body';

      /* Facteurs */
      if (axe.facteurs && axe.facteurs.length) {
        var fHtml = axe.facteurs.map(function(f){
          return '<li><span class="axe-bullet">&#x2022;</span>' + f + '</li>';
        }).join('');
        ficheBody.innerHTML +=
          '<div class="fiche-section">' +
            '<div class="fiche-section-titre">Facteurs</div>' +
            '<ul class="axe-list">' + fHtml + '</ul>' +
          '</div>';
      }

      /* Conséquences */
      if (axe.consequences && axe.consequences.length) {
        var cHtml = axe.consequences.map(function(c){
          return '<li><span class="axe-bullet axe-bullet-arrow">&#x2192;</span>' + c + '</li>';
        }).join('');
        ficheBody.innerHTML +=
          '<div class="fiche-section">' +
            '<div class="fiche-section-titre cons">Cons\u00e9quences</div>' +
            '<ul class="axe-list">' + cHtml + '</ul>' +
          '</div>';
      }

      /* Actions recommandées */
      if (enjeu.actions && enjeu.actions.length) {
        var aHtml = enjeu.actions.map(function(a){
          return '<li><span class="axe-bullet action-bullet">&#x2713;</span>' + a + '</li>';
        }).join('');
        ficheBody.innerHTML +=
          '<div class="fiche-section actions">' +
            '<div class="fiche-section-titre action">Actions recommand\u00e9es</div>' +
            '<ul class="axe-list">' + aHtml + '</ul>' +
          '</div>';
      }

      /* Références Atlas */
      if (enjeu.refs && enjeu.refs.length) {
        var refsHtml = enjeu.refs.map(function(r){
          return '<span class="enjeu-lien" data-id="' + enjeu.id + '">&#x1F5FA; ' + r.n + ' \u2014 ' + r.t + '</span>';
        }).join('');
        ficheBody.innerHTML += '<div class="enjeu-liens" style="margin-top:8px;">' + refsHtml + '</div>';
      }

      /* Toggle fiche */
      ficheHead.addEventListener('click', function() {
        fiche.classList.toggle('ouvert');
      });

      /* Modale au clic sur un lien Atlas */
      ficheBody.querySelectorAll('.enjeu-lien').forEach(function(lien) {
        lien.addEventListener('click', function(ev) {
          ev.stopPropagation();
          ouvrirModale(lien.dataset.id);
        });
      });

      fiche.appendChild(ficheHead);
      fiche.appendChild(ficheBody);
      body.appendChild(fiche);
    });

    /* Toggle accordéon */
    btn.addEventListener('click', function() {
      accord.classList.toggle('ouvert');
    });

    accord.appendChild(btn);
    accord.appendChild(body);
    conteneur.appendChild(accord);
  });
}

/* ════════════════════════════════════════════════════════════════════
   MODALE
   ════════════════════════════════════════════════════════════════════ */

/**
 * Ouvre la modale de fiche détaillée pour un enjeu.
 * @param {string} id  Identifiant de l'enjeu (cherché dans ENJEUX + ENJEUX_ZONES)
 */
function ouvrirModale(id) {
  var enjeu = null;
  var listes = Object.values(ENJEUX);
  for (var i = 0; i < listes.length; i++) {
    var f = listes[i].find(function(x){ return x.id === id; });
    if (f) { enjeu = f; break; }
  }
  if (!enjeu) return;

  document.getElementById('modale-titre').textContent = enjeu.nom;
  var refsStr = (enjeu.refs || []).map(function(r){ return r.n + ' — ' + r.t; }).join(', ');
  document.getElementById('modale-ref').textContent = refsStr;

  /* Build detailed modal from 4-axes structure */
  var AXES_META = {
    environnement: { label:'Environnement', ico:'&#x1F333;', color:'#15803d' },
    economique:    { label:'Economique',    ico:'&#x1F4B0;', color:'#7c3aed' },
    politique:     { label:'Politique',     ico:'&#x1F3DB;', color:'#92400e' },
    social:        { label:'Social',        ico:'&#x1F465;', color:'#be123c' },
  };

  var html = '';
  Object.keys(AXES_META).forEach(function(axeId) {
    var meta = AXES_META[axeId];
    var axe  = enjeu.axes && enjeu.axes[axeId];
    if (!axe) return;
    html += '<h3>' + meta.ico + ' ' + meta.label + '</h3>';
    html += '<strong style="font-size:.78rem;color:#555;">Facteurs :</strong><ul>';
    (axe.facteurs||[]).forEach(function(f){ html += '<li>' + f + '</li>'; });
    html += '</ul><strong style="font-size:.78rem;color:#555;">Conséquences :</strong><ul>';
    (axe.consequences||[]).forEach(function(c){ html += '<li>' + c + '</li>'; });
    html += '</ul>';
  });

  if (enjeu.actions && enjeu.actions.length) {
    html += '<h3>&#x1F4CB; Actions recommandées</h3><ul>';
    enjeu.actions.forEach(function(a){ html += '<li>' + a + '</li>'; });
    html += '</ul>';
  }

  document.getElementById('modale-corps').innerHTML = html;
  document.getElementById('modale-bg').classList.add('on');
}

/**
 * Ferme la modale.
 * @param {Event}   evt    Clic sur le fond (ferme si hors contenu)
 * @param {boolean} force  true = fermeture inconditionnelle
 */
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
    /* Fixer la hauteur courante avant animation de fermeture */
    panel.style.maxHeight = panel.scrollHeight + 'px';
    panel.style.transition = 'max-height .32s ease, opacity .25s ease';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        panel.style.maxHeight = '0';
        panel.style.opacity   = '0';
      });
    });
    panel.addEventListener('transitionend', function onEnd() {
      panel.removeEventListener('transitionend', onEnd);
      panel.classList.remove('contacts-visible');
      panel.classList.add('contacts-hidden');
      panel.style.maxHeight  = '';
      panel.style.opacity    = '';
      panel.style.transition = '';
    });
    trigger.classList.remove('ouvert');
  }
}

/* Genere la liste des contacts filtres selon le projet courant */
function detecterCommuneProjet() {
  /* Retourne { nom, code, codeEpci, population, codesPostaux }
     pour la commune contenant le marqueur du projet, ou null. */
  if (!A.position) return null;
  var lat = A.position.lat, lng = A.position.lng;
  var features = GEOJSON_TB && GEOJSON_TB.features;
  if (!features) return null;
  for (var i = 0; i < features.length; i++) {
    var feat = features[i];
    if (!feat.geometry || feat.geometry.type !== 'Polygon') continue;
    if (pointDansPolygone(lat, lng, feat.geometry.coordinates)) {
      return feat.properties;
    }
  }
  return null;
}

/**
 * Retourne les infos d'un EPCI du Territoire de Belfort.
 * @param  {string} codeEpci  Code INSEE (200069052 | 200069060 | 249000241)
 * @return {{ nom, acronyme, url } | null}
 */
function getEpciInfo(codeEpci) {
  var epciMap = {
    '200069052': {
      id: 'gbca',
      nom: 'Grand Belfort Communaute d\'Agglomeration (GBCA)',
      tel: '03 84 90 72 00',
      email: 'contact@grandbelfort.fr',
      adresse: '1 rue Georges Pompidou, BP 10 649, 90020 Belfort Cedex',
      web: 'https://www.grandbelfort.fr',
      note: 'Votre projet est situe dans l\'une des 50 communes de GBCA. Interlocuteur pour l\'urbanisme (PLU), l\'economie et l\'habitat.'
    },
    '200069060': {
      id: 'ccvs',
      nom: 'Communaute de Communes des Vosges du Sud (CCVS)',
      tel: '03 84 29 14 00',
      email: '[À compléter]@vosges-du-sud.fr',
      adresse: '4 rue de l\'Hotel de Ville, 90200 Giromagny',
      web: 'https://www.ccvosgesdu-sud.fr',
      note: 'Votre projet est dans le perimetre de la CCVS (22 communes). PLUi en cours d\'elaboration — contacter pour verifier les implications sur le zonage futur.'
    },
    '249000241': {
      id: 'ccst',
      nom: 'Communaute de Communes du Sud Territoire (CCST)',
      tel: '03 84 36 21 35',
      email: '[À compléter]@sudterritoire.fr',
      adresse: '1 place de la Republique, 90100 Delle',
      web: '[À compléter]',
      note: 'Votre projet est dans le perimetre de la CCST. Zone transfrontaliere (proximite Suisse). Programme agroecologique "L\'Eau d\'Ici".'
    }
  };
  return epciMap[codeEpci] || null;
}

/**
 * Construit la liste des contacts filtrés selon le type de projet
 * et les zones actives. Injecte dans #contacts-ctx et #contacts-liste.
 */
function genererContacts() {
  var type   = A.typeProjet;
  var taille = A.taille;

  /* ── 1. Détecter commune + EPCI depuis la position ── */
  var commune  = detecterCommuneProjet();
  var epciInfo = commune ? getEpciInfo(commune.codeEpci) : null;

  /* ── 2. Récupérer les zones actives (issues de l'analyse) ── */
  var zonesActives = new Set();
  if (A.position) {
    var zonesRes = detecterZones(A.position.lat, A.position.lng, type);
    zonesRes.forEach(function(res) {
      res.zones.forEach(function(z) { zonesActives.add(z.type); });
    });
  }

  /* ── 3. Contexte du projet ── */
  var ctxEl   = document.getElementById('contacts-ctx');
  var typeInfo = TYPES.find(function(t){ return t.id === type; });
  var chips   = [];
  if (typeInfo) chips.push(typeInfo.ico + ' ' + typeInfo.label);
  chips.push(TAILLES[taille].nom);
  if (commune) chips.push('📍 ' + commune.nom + (commune.codesPostaux && commune.codesPostaux.length ? ' (' + commune.codesPostaux[0] + ')' : ''));
  else if (A.position) chips.push('📍 Lat ' + A.position.lat.toFixed(3) + ', Lng ' + A.position.lng.toFixed(3));

  ctxEl.innerHTML = '<span style="color:var(--rf-mid);font-weight:600;font-size:.72rem;margin-right:4px;">Projet :</span>' +
    chips.map(function(c){
      return '<span class="ctx-chip">' + c + '</span>';
    }).join('');

  /* ── 4. Construire la liste de contacts dynamiques ── */
  var liste = document.getElementById('contacts-liste');
  liste.innerHTML = '';
  var totalAffiche = 0;

  /* ── Groupe 0 : ACTEURS LOCAUX (mairie + EPCI) ── */
  var contactsLocaux = [];

  /* Mairie de la commune détectée */
  if (commune) {
    var cp = (commune.codesPostaux && commune.codesPostaux.length) ? commune.codesPostaux[0] : '90000';
    contactsLocaux.push({
      id:       'mairie-' + commune.code,
      nom:      'Mairie de ' + commune.nom,
      role:     'Premier interlocuteur pour tout projet de construction. Instruction des permis de construire (PC), déclarations préalables (DP) et certificats d\'urbanisme (CU). Consultation du PLU applicable.',
      priorite: 'obligatoire',
      types:    [type],
      tmin:     1,
      tel:      '[Consulter pagesjaunes.fr]',
      email:    '[Consulter le site de la commune]',
      adresse:  'Mairie de ' + commune.nom + ', ' + cp + ' ' + commune.nom,
      web:      '[Consulter annuaire.service-public.fr]',
      horaires: '[Variable selon la commune — vérifier en mairie]',
      note:     'Commune de ' + commune.nom + ' (' + (commune.population || '?') + ' hab.) — ' +
                'Consultez d\'abord la mairie pour vérifier le zonage PLU et les règles locales d\'urbanisme avant tout dépôt.'
    });
  }

  /* EPCI compétent */
  if (epciInfo) {
    contactsLocaux.push({
      id:       epciInfo.id + '-local',
      nom:      epciInfo.nom,
      role:     'Intercommunalité compétente pour votre secteur : urbanisme (PLU/PLUi), développement économique, habitat, transports, environnement.',
      priorite: 'obligatoire',
      types:    [type],
      tmin:     1,
      tel:      epciInfo.tel,
      email:    epciInfo.email,
      adresse:  epciInfo.adresse,
      web:      epciInfo.web,
      horaires: 'Lun-Ven 8h30-12h00 / 13h30-17h00',
      note:     epciInfo.note
    });
  }

  if (contactsLocaux.length > 0) {
    var groupeLocal = document.createElement('div');
    groupeLocal.className = 'contact-groupe';
    groupeLocal.innerHTML =
      '<div class="contact-groupe-titre">' +
        '<span class="groupe-ico">📍</span>' +
        'Acteurs locaux — ' + (commune ? commune.nom : 'Commune détectée') +
      '</div>';
    contactsLocaux.forEach(function(c) { groupeLocal.appendChild(creerCarteContact(c)); });
    liste.appendChild(groupeLocal);
    totalAffiche += contactsLocaux.length;
  }

  /* ── Groupes CONTACTS_DB avec filtrage zone-aware ── */
  /* Règles de pertinence par contact ID en fonction des zones actives */
  var CONTACT_ZONES_REQUISES = {
    'udap90':       ['MH_classe','MH_inscrit','perimetre_MH','zppa','site_archeo'],
    'ars':          ['captage_aep','radon','moustique','bruit_1','trafic_fort'],
    'onf':          ['foret','feux_foret','reservoir','natura2000'],
    'agence-eau':   ['zone_humide','cours_eau','sage','captage_aep','nitrates'],
    'atmo':         ['bruit_1','trafic_fort'],
    'chambre-agri': ['nitrates','zone_humide','captage_aep'],
    'safer':        null, /* toujours si type agriculture */
  };

  /* IDs déjà injectés en local (ne pas dupliquer) */
  var dejaAffiche = new Set(epciInfo ? [epciInfo.id] : []);

  Object.keys(CONTACTS_DB).forEach(function(groupeId) {
    var groupe = CONTACTS_DB[groupeId];

    var contactsFiltres = groupe.contacts.filter(function(c) {
      /* Déduplication : pas de doublon avec acteurs locaux */
      if (dejaAffiche.has(c.id)) return false;

      /* Filtre type + envergure */
      if (c.types.indexOf(type) === -1) return false;
      if (c.tmin > taille) return false;

      /* Filtre zones-aware : certains contacts ne sont pertinents
         que si une zone spécifique est détectée */
      var zonesReq = CONTACT_ZONES_REQUISES[c.id];
      if (zonesReq === undefined) return true; /* pas de contrainte zone */
      if (zonesReq === null) return true;       /* toujours si type ok */
      /* Afficher seulement si au moins une zone requise est active */
      return zonesReq.some(function(z) { return zonesActives.has(z); });
    });

    if (contactsFiltres.length === 0) return;
    totalAffiche += contactsFiltres.length;

    /* Trier : obligatoire > recommande > optionnel */
    var prioOrd = { obligatoire: 0, recommande: 1, optionnel: 2 };
    contactsFiltres.sort(function(a, b){ return prioOrd[a.priorite] - prioOrd[b.priorite]; });

    var groupeEl = document.createElement('div');
    groupeEl.className = 'contact-groupe';
    groupeEl.innerHTML =
      '<div class="contact-groupe-titre">' +
        '<span class="groupe-ico">' + groupe.ico + '</span>' +
        groupe.label +
      '</div>';

    contactsFiltres.forEach(function(c) { groupeEl.appendChild(creerCarteContact(c)); });
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

  /* ── Contexte projet ── */
  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  var stList   = SOUS_TYPES[A.typeProjet] || [];
  var stInfo   = stList.find(function(s){ return s.id === A.sousType; });

  /* ── Localisation depuis la carte ── */
  var commune  = detecterCommuneProjet();
  var epciInfo = commune ? getEpciInfo(commune.codeEpci) : null;

  /* Construire le HTML du bandeau contextuel */
  var lignes = [];

  /* Ligne 1 : type de projet */
  var typeTxt = typeInfo ? (typeInfo.ico + ' <strong>' + typeInfo.label + '</strong>') : '';
  if (stInfo) typeTxt += ' › ' + stInfo.label;
  typeTxt += ' <span class="cl-ctx-sep">—</span> ' + etapes.length + ' étape(s)';
  lignes.push('<div class="cl-ctx-ligne cl-ctx-projet">' + typeTxt + '</div>');

  /* Ligne 2 : commune + EPCI si position connue */
  if (commune) {
    var cp     = (commune.codesPostaux && commune.codesPostaux.length) ? commune.codesPostaux[0] : '';
    var pop    = commune.population ? ' · ' + commune.population.toLocaleString('fr-FR') + ' hab.' : '';
    var epciNom = epciInfo ? epciInfo.nom.replace(/\(.*\)/, '').trim() : '';
    var locTxt  = '📍 <strong>' + commune.nom + '</strong>' +
                  (cp ? ' <span class="cl-ctx-cp">' + cp + '</span>' : '') +
                  pop;
    if (epciNom) locTxt += ' <span class="cl-ctx-sep">·</span> ' + epciNom;
    lignes.push('<div class="cl-ctx-ligne cl-ctx-loc">' + locTxt + '</div>');

    /* Ligne 3 : mairie comme premier interlocuteur */
    lignes.push(
      '<div class="cl-ctx-ligne cl-ctx-mairie">' +
        '🏛 Déposer le dossier à la <strong>Mairie de ' + commune.nom + '</strong> — ' +
        'vérifier le PLU avant tout dépôt' +
      '</div>'
    );
  } else if (A.position) {
    lignes.push(
      '<div class="cl-ctx-ligne cl-ctx-loc">' +
        '📍 Lat ' + A.position.lat.toFixed(4) + ', Lng ' + A.position.lng.toFixed(4) +
        ' <span class="cl-ctx-warn">(commune non identifiée — vérifier la position)</span>' +
      '</div>'
    );
  } else {
    lignes.push(
      '<div class="cl-ctx-ligne cl-ctx-warn">' +
        '⚠️ Aucune position sur la carte — placez le projet pour identifier la commune' +
      '</div>'
    );
  }

  ctxEl.innerHTML = lignes.join('');

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

/* Tutorial init is handled inside the main DOMContentLoaded above */

/* ── Afficher le tutoriel ──────────────────────────────────────── */
function afficherTutoriel() {
  tuto.slide   = 0;
  tuto.sgActif = false;
  var overlay = document.getElementById('tuto-overlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
  renderSlide();  /* Render slide 0 immediately */
}

/* ── Fermer le tutoriel ────────────────────────────────────────── */
function fermerTutoriel() {
  var overlay = document.getElementById('tuto-overlay');
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
  try { localStorage.setItem('ddt90_tuto_v3', '1'); } catch(e) {}
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
  var slide = TUTO_SLIDES[tuto.slide];
  if (!slide) { tuto.slide = 0; slide = TUTO_SLIDES[0]; }  /* guard */
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

/* Lance le Serious Game pédagogique depuis la dernière slide du tutoriel. */
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
}  /* ── fin afficherScoreSG ── */

/* ════════════════════════════════════════════════════════════════════
   THEME SOMBRE — toggleDarkMode / initTheme
   ════════════════════════════════════════════════════════════════════ */

/* Bascule le thème sombre/clair et persiste le choix dans localStorage. */
function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark-mode');
  var icon   = document.getElementById('dark-mode-icon');
  icon.textContent = isDark ? '☀️' : '🌙';
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e) {}
}

/* Lit localStorage et applique le thème sombre/clair au démarrage. */
function initTheme() {
  var saved = '';
  try { saved = localStorage.getItem('theme') || ''; } catch(e) {}
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    var icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = '☀️';
  }
}

/* ════════════════════════════════════════════════════════════════════
   ONGLETS DU PANNEAU DROIT
   ════════════════════════════════════════════════════════════════════ */

/**
 * Affiche l'onglet demandé dans le panneau droit et masque l'autre.
 * @param {string} id  "enjeux" | "simulation"
 */
function switchTab(id) {
  /* Activer le bouton */
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('actif', b.id === 'tab-btn-' + id);
  });
  /* Afficher le bon panneau */
  document.getElementById('tab-enjeux').style.display     = id === 'enjeux'     ? 'block' : 'none';
  document.getElementById('tab-simulation').style.display = id === 'simulation' ? 'block' : 'none';
}

/* ════════════════════════════════════════════════════════════════════
   MOTEUR DE SIMULATION DE PROJET
   Calcule : durée estimée, complexité, impact environnemental
   en fonction du type, de la taille, et de la localisation
   ════════════════════════════════════════════════════════════════════ */

/* ── Tables de base par type de projet ── */
var SIM_BASE = {
  logement:    { ico:'🏘', dureeBase:[6,12,18,36],   complexBase:[25,45,65,85],  impactBase:[20,40,55,75] },
  zae:         { ico:'🏭', dureeBase:[8,14,24,48],   complexBase:[35,55,70,90],  impactBase:[35,55,70,85] },
  equipement:  { ico:'🏫', dureeBase:[10,18,30,48],  complexBase:[40,60,75,90],  impactBase:[25,40,55,70] },
  energie:     { ico:'⚡', dureeBase:[12,24,36,60],  complexBase:[50,65,80,95],  impactBase:[10,20,30,40] },
  transport:   { ico:'🛣', dureeBase:[12,24,48,72],  complexBase:[45,65,80,92],  impactBase:[40,60,75,88] },
  agriculture: { ico:'🌾', dureeBase:[3,6,12,18],    complexBase:[15,30,45,60],  impactBase:[10,20,35,50] },
  nature:      { ico:'🌳', dureeBase:[4,8,12,24],    complexBase:[20,35,50,65],  impactBase:[-30,-50,-65,-80] },
  friche:      { ico:'🔄', dureeBase:[12,24,36,48],  complexBase:[55,70,82,95],  impactBase:[-20,-35,-50,-65] },
};

/* ── Facteurs liés à la localisation ── */
/* Zones à risque dans le Territoire de Belfort : PPRi Savoureuse/Bourbeuse/Allaine */
var ZONES_RISQUE = [
  /* PPRi Savoureuse */
  { lat:[47.59,47.72], lng:[6.84,6.89], label:'Zone PPRi Savoureuse', complexite:+15, duree:+3, impact:+10 },
  /* PPRi Bourbeuse */
  { lat:[47.62,47.66], lng:[6.70,6.89], label:'Zone PPRi Bourbeuse',  complexite:+12, duree:+2, impact:+8  },
  /* PPRi Allaine */
  { lat:[47.50,47.56], lng:[6.90,6.98], label:'Zone PPRi Allaine',    complexite:+12, duree:+2, impact:+8  },
  /* Vosges du Sud (Natura 2000 + ZNIEFF) */
  { lat:[47.70,47.87], lng:[6.65,6.82], label:'Zone Natura 2000 / ZNIEFF Vosges', complexite:+20, duree:+6, impact:+15 },
  /* MH Belfort centre */
  { lat:[47.62,47.65], lng:[6.84,6.89], label:'Perimetre Monument Historique',    complexite:+10, duree:+2, impact:+5  },
  /* Zone nitrates Sundgau */
  { lat:[47.48,47.65], lng:[6.88,7.10], label:'Zone vulnerable nitrates',         complexite:+8,  duree:+1, impact:+5  },
  /* Zone sismique 3 (Vosges) */
  { lat:[47.68,47.87], lng:[6.64,6.83], label:'Zone sismicite 3',                 complexite:+5,  duree:+1, impact:+3  },
];

/* ── Lance la simulation ── */
function lancerSimulation() {
  if (!A.typeProjet) {
    alert("Selectionnez d'abord un type de projet dans le panneau gauche.");
    switchTab('enjeux');
    return;
  }

  var base   = SIM_BASE[A.typeProjet];
  var taille = A.taille;  /* 1-4 */
  var tidx   = taille - 1;

  /* Valeurs de base */
  var duree    = base.dureeBase[tidx];
  var complex  = base.complexBase[tidx];
  var impact   = base.impactBase[tidx];

  /* Superficie (si plus grande que la taille standard, +10% par ha supplementaire jusqu'à +30%) */
  var bonusSuperficie = 1;
  if (A.superficieHa) {
    var seuilsHa = [0.5, 5, 20, 100];
    var seuil = seuilsHa[tidx];
    if (A.superficieHa > seuil) {
      var ratio = Math.min((A.superficieHa / seuil), 3);
      bonusSuperficie = 1 + (ratio - 1) * 0.15;
      duree   = Math.round(duree   * bonusSuperficie);
      complex = Math.min(99, Math.round(complex * (1 + (ratio - 1) * 0.08)));
    }
  }

  /* Facteurs localisation */
  var alertesLoc = [];
  if (A.position) {
    ZONES_RISQUE.forEach(function(zone) {
      var inLat = A.position.lat >= zone.lat[0] && A.position.lat <= zone.lat[1];
      var inLng = A.position.lng >= zone.lng[0] && A.position.lng <= zone.lng[1];
      if (inLat && inLng) {
        duree   += zone.duree;
        complex = Math.min(99, complex + zone.complexite);
        impact  += zone.impact;
        alertesLoc.push(zone.label);
      }
    });
  }

  /* Clamp */
  duree   = Math.max(1, duree);
  complex = Math.max(1, Math.min(99, complex));
  var impactAbs = Math.abs(impact);
  var impactPos = impact < 0;  /* Valeur négative = impact positif sur l'environnement */
  impactAbs = Math.min(99, Math.max(1, impactAbs));

  /* Formatage de la durée */
  var dureeStr;
  if (duree < 3)       dureeStr = duree + ' mois';
  else if (duree < 12) dureeStr = duree + ' mois';
  else if (duree < 24) dureeStr = '~1 an';
  else if (duree < 36) dureeStr = '~2 ans (' + duree + ' mois)';
  else if (duree < 60) dureeStr = '~3 ans (' + duree + ' mois)';
  else                 dureeStr = '~' + Math.round(duree / 12) + ' ans';

  /* Niveaux textuels */
  var complexLabel = complex < 30 ? 'Simple' : complex < 50 ? 'Modérée' : complex < 70 ? 'Elevée' : complex < 85 ? 'Complexe' : 'Très complexe';
  var impactLabel  = impactPos
    ? (impactAbs < 30 ? 'Léger bénéfice' : impactAbs < 55 ? 'Bénéfice notable' : impactAbs < 75 ? 'Fort bénéfice' : 'Très bénéfique')
    : (impactAbs < 30 ? 'Impact faible'  : impactAbs < 55 ? 'Impact modéré'    : impactAbs < 75 ? 'Impact fort'   : 'Impact majeur');

  /* Alertes générales selon type+taille */
  var alertesGen = calculerAlertesGenerales(A.typeProjet, taille, A.superficieHa);

  /* Recommandations */
  var recos = calculerRecommandations(A.typeProjet, taille, alertesLoc, impactPos);

  /* Rendu */
  afficherResultatSimulation({
    typeId:       A.typeProjet,
    ico:          base.ico,
    duree:        duree,
    dureeStr:     dureeStr,
    complex:      complex,
    complexLabel: complexLabel,
    impact:       impactAbs,
    impactPos:    impactPos,
    impactLabel:  impactLabel,
    alertesLoc:   alertesLoc,
    alertesGen:   alertesGen,
    recos:        recos,
  });

  /* Passer sur l'onglet simulation */
  switchTab('simulation');
}

/* ── Calcule les alertes générales ── */
function calculerAlertesGenerales(typeId, taille, superficieHa) {
  var alertes = [];
  var sup = superficieHa || 0;

  if (typeId === 'energie' && taille >= 3)
    alertes.push({ cls:'orange', ico:'⚡', txt: 'Etude d\'impact obligatoire pour les projets ENR >1 MW. Consultation DREAL et enquête publique probable.' });
  if (typeId === 'friche')
    alertes.push({ cls:'rouge',  ico:'☣', txt: 'Diagnostic BASIAS/BASOL et étude ESE Phase 1 indispensables avant tout dépôt de permis.' });
  if (typeId === 'agriculture' && sup > 5)
    alertes.push({ cls:'orange', ico:'🌾', txt: 'Consultation CDPENAF obligatoire pour tout projet réduisant la SAU. Avis de la Chambre d\'Agriculture.' });
  if (sup > 1)
    alertes.push({ cls:'bleu',   ico:'💧', txt: 'Déclaration loi sur l\'eau (IOTA) nécessaire si imperméabilisation >1 ha ou impact sur cours d\'eau.' });
  if (taille >= 3)
    alertes.push({ cls:'orange', ico:'📋', txt: 'Projet de grande envergure : prévoir une phase d\'études de 6 à 12 mois avant le dépôt du dossier.' });
  if (taille >= 4)
    alertes.push({ cls:'rouge',  ico:'📢', txt: 'Projet majeur : enquête publique et concertation préalable très probables. Délais allongés.' });

  return alertes;
}

/* ── Calcule les recommandations ── */
function calculerRecommandations(typeId, taille, alertesLoc, impactPositif) {
  var recos = [
    { ico:'🗺', txt: 'Activez les couches thématiques de l\'Atlas DDT 90 pour visualiser les contraintes de votre zone.' },
    { ico:'📞', txt: 'Prenez contact avec la DDT 90 en amont (03 84 58 86 00). Un rendez-vous préalable évite de nombreux allers-retours.' },
    { ico:'✅', txt: 'Consultez la checklist administrative (onglet Enjeux) pour suivre les étapes obligatoires.' },
  ];

  if (alertesLoc.length > 0)
    recos.push({ ico:'⚠', txt: 'Votre localisation déclenche des contraintes spécifiques. Consultez les fiches enjeux correspondantes.' });
  if (typeId === 'energie')
    recos.push({ ico:'☀', txt: 'Vérifiez le cadastre solaire (Atlas C22) et le potentiel éolien (C24) pour votre commune.' });
  if (typeId === 'friche')
    recos.push({ ico:'🏗', txt: 'L\'EPF BFC peut assurer le portage foncier pendant la dépollution. Contactez-les tôt.' });
  if (impactPositif)
    recos.push({ ico:'🌱', txt: 'Projet à impact positif sur l\'environnement. Valorisez cet argument dans vos dossiers de demande de financement.' });
  if (taille >= 3)
    recos.push({ ico:'📅', txt: 'Planifiez un calendrier de projet réaliste avec 20% de marge sur les délais estimés. Les recours sont fréquents.' });

  return recos;
}

/* ── Affiche les résultats ── */
function afficherResultatSimulation(r) {
  document.getElementById('sim-empty').style.display  = 'none';
  var res = document.getElementById('sim-result');
  res.style.display = 'block';

  var typeInfo = TYPES.find(function(t){ return t.id === r.typeId; });
  var typeLabel = typeInfo ? typeInfo.label : r.typeId;

  /* Chips de contexte */
  var chips = [typeLabel, TAILLES[A.taille].nom];
  if (A.superficieHa) chips.push(A.superficieHa.toFixed(2) + ' ha');
  if (A.position) chips.push('Projet positionné');
  var chipsHtml = chips.map(function(c){ return '<span class="sim-chip">' + c + '</span>'; }).join('');

  /* Alertes localisation */
  var alertesLocHtml = '';
  if (r.alertesLoc.length > 0) {
    alertesLocHtml = r.alertesLoc.map(function(a){
      return '<div class="sim-alerte rouge"><span class="sim-alerte-ico">📍</span><span><strong>Zone sensible :</strong> ' + a + '</span></div>';
    }).join('');
  }

  /* Alertes générales */
  var alertesGenHtml = r.alertesGen.map(function(a){
    return '<div class="sim-alerte ' + a.cls + '"><span class="sim-alerte-ico">' + a.ico + '</span><span>' + a.txt + '</span></div>';
  }).join('');

  /* Recommandations */
  var recosHtml = r.recos.map(function(rec){
    return '<li class="sim-reco-item"><span class="r-ico">' + rec.ico + '</span><span>' + rec.txt + '</span></li>';
  }).join('');

  /* Fill couleur impact */
  var impactFill = r.impactPos ? 'fill-impact-pos' : 'fill-impact-neg';
  var impactColor = r.impactPos ? '#10b981' : '#ef4444';

  res.innerHTML =
    '<div class="sim-card">' +

      /* En-tête */
      '<div class="sim-card-hdr">' +
        '<div class="sim-card-ico">' + r.ico + '</div>' +
        '<div class="sim-card-meta">' +
          '<div class="sim-card-titre">Simulation — ' + typeLabel + '</div>' +
          '<div class="sim-chips">' + chipsHtml + '</div>' +
        '</div>' +
      '</div>' +

      /* Jauges */
      '<div class="sim-jauges">' +

        /* Durée */
        '<div class="sim-jauge">' +
          '<div class="sim-jauge-top">' +
            '<div class="sim-jauge-label"><span class="j-ico">⏱</span> Durée estimée</div>' +
            '<div class="sim-jauge-valeur">' + r.dureeStr + '</div>' +
          '</div>' +
          '<div class="sim-gauge-track"><div class="sim-gauge-fill fill-duree" style="width:' + Math.min(100, Math.round(r.duree/72*100)) + '%"></div></div>' +
          '<div class="sim-jauge-sous">De l\'étude préalable à la réception des travaux, instruction incluse.</div>' +
        '</div>' +

        /* Complexité */
        '<div class="sim-jauge">' +
          '<div class="sim-jauge-top">' +
            '<div class="sim-jauge-label"><span class="j-ico">⚙️</span> Complexité administrative</div>' +
            '<div class="sim-jauge-valeur">' + r.complexLabel + ' (' + r.complex + '/100)</div>' +
          '</div>' +
          '<div class="sim-gauge-track"><div class="sim-gauge-fill fill-complexite" style="width:' + r.complex + '%"></div></div>' +
          '<div class="sim-jauge-sous">Nombre de procédures, consultations et acteurs impliqués.</div>' +
        '</div>' +

        /* Impact environnemental */
        '<div class="sim-jauge">' +
          '<div class="sim-jauge-top">' +
            '<div class="sim-jauge-label"><span class="j-ico">🌿</span> Impact environnemental</div>' +
            '<div class="sim-jauge-valeur" style="color:' + impactColor + '">' + r.impactLabel + ' (' + r.impact + '/100)</div>' +
          '</div>' +
          '<div class="sim-gauge-track"><div class="sim-gauge-fill ' + impactFill + '" style="width:' + r.impact + '%"></div></div>' +
          '<div class="sim-jauge-sous">' + (r.impactPos ? '🌱 Ce projet a un bilan environnemental favorable (renaturation, ENR...).' : '⚠ Impact sur les sols, l\'eau et la biodiversité à anticiper.') + '</div>' +
        '</div>' +

      '</div>' + /* /sim-jauges */

      /* Facteurs contextuels */
      '<div class="sim-facteurs">' +
        '<div class="sim-section-titre">📊 Facteurs contextuels</div>' +
        '<div class="sim-facteur-grid">' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Superficie</div>' +
            '<div class="sim-facteur-val">' + (A.superficieHa ? A.superficieHa.toFixed(2) + ' ha' : 'Non renseignée') + '</div>' +
            '<div class="sim-facteur-sub">' + TAILLES[A.taille].nom + '</div>' +
          '</div>' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Localisation</div>' +
            '<div class="sim-facteur-val">' + (A.position ? 'Définie' : 'Non définie') + '</div>' +
            '<div class="sim-facteur-sub">' + (A.position ? 'Lat ' + A.position.lat.toFixed(3) : 'Placez le projet sur la carte') + '</div>' +
          '</div>' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Zones détectées</div>' +
            '<div class="sim-facteur-val">' + r.alertesLoc.length + '</div>' +
            '<div class="sim-facteur-sub">' + (r.alertesLoc.length > 0 ? 'Contraintes locales' : 'Aucune contrainte locale') + '</div>' +
          '</div>' +
          '<div class="sim-facteur-item">' +
            '<div class="sim-facteur-nom">Procédures</div>' +
            '<div class="sim-facteur-val">' + (A.taille <= 1 ? '1-3' : A.taille === 2 ? '3-5' : A.taille === 3 ? '5-8' : '8-15') + '</div>' +
            '<div class="sim-facteur-sub">Autorisations estimées</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Alertes */
      ((alertesLocHtml || alertesGenHtml) ?
        '<div class="sim-alertes">' +
          '<div class="sim-section-titre">🔔 Points d\'attention</div>' +
          alertesLocHtml + alertesGenHtml +
        '</div>' : '') +

      /* Recommandations */
      '<div class="sim-reco">' +
        '<div class="sim-section-titre">💡 Recommandations</div>' +
        '<ul class="sim-reco-list">' + recosHtml + '</ul>' +
      '</div>' +

      /* Actions */
      '<div class="sim-actions">' +
        '<button class="sim-btn-primary" onclick="lancerSimulation()">🔄 Relancer</button>' +
        '<button class="sim-btn-secondary" onclick="switchTab(\'enjeux\'); lancerAnalyse()">📋 Voir les enjeux</button>' +
      '</div>' +

    '</div>'; /* /sim-card */
}

/* ════════════════════════════════════════════════════════════════════
   PROJETS ALENTOURS
   Utilise l'API Overpass (OpenStreetMap) pour interroger les
   etablissements du meme type dans un rayon autour du projet.
   La requete est construite dynamiquement selon le sous-type OSM.
   ════════════════════════════════════════════════════════════════════ */

/* ── Correspondance sous-type → tags OSM Overpass ────────────────
   Format : { key: 'amenity', value: 'school' }
   Plusieurs tags possibles (tableau = OR logique)
   ─────────────────────────────────────────────────────────────── */
var OSM_TAGS = {
  /* Logement */
  maison:        [{ key:'building', value:'house' }, { key:'building', value:'detached' }],
  lotissement:   [{ key:'landuse', value:'residential' }],
  collectif:     [{ key:'building', value:'apartments' }, { key:'building', value:'residential' }],
  hlm:           [{ key:'building', value:'apartments' }, { key:'social_facility', value:'housing' }],
  residence:     [{ key:'building', value:'dormitory' }, { key:'tourism', value:'hostel' }],
  camping:       [{ key:'tourism', value:'camp_site' }, { key:'tourism', value:'caravan_site' }],

  /* ZAE */
  artisanat:     [{ key:'craft', value:'*' }],
  commerce:      [{ key:'shop', value:'supermarket' }, { key:'shop', value:'department_store' }, { key:'shop', value:'mall' }],
  bureau:        [{ key:'office', value:'*' }],
  industrie:     [{ key:'landuse', value:'industrial' }, { key:'building', value:'industrial' }],
  logistique:    [{ key:'landuse', value:'industrial' }, { key:'building', value:'warehouse' }],
  agricole_bat:  [{ key:'building', value:'barn' }, { key:'building', value:'farm_auxiliary' }],
  parc_act:      [{ key:'landuse', value:'industrial' }, { key:'landuse', value:'commercial' }],

  /* Equipement */
  ecole:         [{ key:'amenity', value:'school' }, { key:'amenity', value:'college' }],
  sante:         [{ key:'amenity', value:'hospital' }, { key:'amenity', value:'clinic' }, { key:'amenity', value:'doctors' }],
  sport:         [{ key:'leisure', value:'sports_centre' }, { key:'leisure', value:'stadium' }, { key:'leisure', value:'swimming_pool' }],
  culture:       [{ key:'amenity', value:'theatre' }, { key:'amenity', value:'cinema' }, { key:'amenity', value:'library' }],
  culte:         [{ key:'amenity', value:'place_of_worship' }],
  administratif: [{ key:'amenity', value:'townhall' }, { key:'amenity', value:'police' }, { key:'office', value:'government' }],
  technique:     [{ key:'amenity', value:'fire_station' }, { key:'amenity', value:'waste_disposal' }],
  hebergement:   [{ key:'social_facility', value:'*' }, { key:'amenity', value:'shelter' }],

  /* Energie */
  pv_toiture:    [{ key:'generator:source', value:'solar' }, { key:'power', value:'generator' }],
  pv_sol:        [{ key:'power', value:'plant' }, { key:'generator:source', value:'solar' }],
  eolien:        [{ key:'generator:source', value:'wind' }, { key:'power', value:'generator' }],
  biomasse:      [{ key:'generator:source', value:'biomass' }, { key:'amenity', value:'heating_station' }],
  hydrogene:     [{ key:'industrial', value:'hydrogen' }],
  ombriere:      [{ key:'amenity', value:'parking' }, { key:'covered', value:'yes' }],

  /* Transport */
  voirie:        [{ key:'highway', value:'residential' }, { key:'highway', value:'tertiary' }],
  parking:       [{ key:'amenity', value:'parking' }],
  piste_velo:    [{ key:'highway', value:'cycleway' }],
  gare:          [{ key:'railway', value:'station' }, { key:'amenity', value:'bus_station' }],
  pont:          [{ key:'bridge', value:'yes' }],
  giratoire:     [{ key:'junction', value:'roundabout' }],

  /* Agriculture */
  elevage:       [{ key:'landuse', value:'farmyard' }, { key:'building', value:'cowshed' }],
  maraichage:    [{ key:'landuse', value:'farmland' }, { key:'building', value:'greenhouse' }],
  cereales:      [{ key:'landuse', value:'farmland' }, { key:'crop', value:'*' }],
  vente_directe: [{ key:'shop', value:'farm' }, { key:'amenity', value:'marketplace' }],
  bio:           [{ key:'organic', value:'yes' }, { key:'shop', value:'organic' }],
  agrivoltaisme: [{ key:'generator:source', value:'solar' }, { key:'landuse', value:'farmland' }],
  irrigation:    [{ key:'man_made', value:'pipeline' }, { key:'waterway', value:'canal' }],

  /* Nature */
  parc_urbain:   [{ key:'leisure', value:'park' }, { key:'leisure', value:'garden' }],
  renaturation:  [{ key:'natural', value:'grassland' }, { key:'landuse', value:'meadow' }],
  foret:         [{ key:'landuse', value:'forest' }, { key:'natural', value:'wood' }],
  zh_restauration:[{ key:'natural', value:'wetland' }],
  cours_eau:     [{ key:'waterway', value:'river' }, { key:'waterway', value:'stream' }],
  piste_nature:  [{ key:'highway', value:'path' }, { key:'route', value:'hiking' }],

  /* Friche */
  friche_ind:    [{ key:'landuse', value:'brownfield' }, { key:'building', value:'ruins' }],
  friche_comm:   [{ key:'landuse', value:'brownfield' }, { key:'shop', value:'vacant' }],
  friche_agri:   [{ key:'landuse', value:'brownfield' }, { key:'abandoned:landuse', value:'farmland' }],
  friche_fer:    [{ key:'railway', value:'abandoned' }, { key:'landuse', value:'railway' }],
  renat_friche:  [{ key:'landuse', value:'brownfield' }],

  /* Fallback générique */
  _default:      [{ key:'building', value:'yes' }],
};

/* ── État alentours ── */
var alentours = {
  ouvert:      false,
  rayon:       3000,        /* mètres */
  layer:       null,        /* L.LayerGroup sur la carte */
  resultats:   [],          /* features OSM */
  enCours:     false,
};

/* ── Toggle ouverture panneau ── */
function toggleAlentours() {
  alentours.ouvert = !alentours.ouvert;
  var panel   = document.getElementById('alentours-panel');
  var trigger = document.getElementById('alentours-trigger');
  if (alentours.ouvert) {
    panel.classList.remove('al-hidden');
    panel.classList.add('al-visible');
    trigger.classList.add('ouvert');
    /* Lancer la recherche si pas encore fait */
    if (alentours.resultats.length === 0 && !alentours.enCours) {
      rechercherAlentours();
    }
  } else {
    panel.classList.remove('al-visible');
    panel.classList.add('al-hidden');
    trigger.classList.remove('ouvert');
  }
}

/* ── Mise à jour du rayon ── */
function majRayonAlentours(val) {
  alentours.rayon = parseInt(val);
  var km = (alentours.rayon / 1000).toFixed(1);
  document.getElementById('al-rayon-txt').textContent = km.replace('.0', '') + ' km';
  /* Relancer la recherche */
  alentours.resultats = [];
  rechercherAlentours();
}

/* ── Construit la requête Overpass ── */
function buildOverpassQuery(lat, lng, rayon, sousType) {
  var tags = OSM_TAGS[sousType] || OSM_TAGS['_default'];
  var around = 'around:' + rayon + ',' + lat + ',' + lng;
  var queries = tags.map(function(tag) {
    var filter = tag.value === '*'
      ? '[' + tag.key + ']'
      : '[' + tag.key + '="' + tag.value + '"]';
    return (
      'node' + filter + '(' + around + ');' +
      'way'  + filter + '(' + around + ');' +
      'relation' + filter + '(' + around + ');'
    );
  }).join('');
  return '[out:json][timeout:15];(' + queries + ');out center 50;';
}

/* ── Calcule la distance entre deux points (formule haversine) ── */
function distanceKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Lance la recherche via Overpass ── */
function rechercherAlentours() {
  if (!A.position) return;
  var sousType = A.sousType || '_default';

  alentours.enCours = true;
  var liste = document.getElementById('alentours-liste');
  liste.innerHTML =
    '<div class="al-loading"><div class="al-spinner"></div>Recherche en cours sur OpenStreetMap…</div>';

  var query = buildOverpassQuery(A.position.lat, A.position.lng, alentours.rayon, sousType);
  var url   = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

  fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      alentours.enCours  = false;
      alentours.resultats = data.elements || [];
      afficherResultatsAlentours();
    })
    .catch(function(err) {
      alentours.enCours = false;
      console.warn('Overpass error:', err);
      liste.innerHTML =
        '<div class="al-empty">⚠ Impossible de joindre OpenStreetMap.<br/>Vérifiez votre connexion et réessayez.</div>';
    });
}

/* ── Affiche les résultats sur le panneau et la carte ── */
function afficherResultatsAlentours() {
  var liste    = document.getElementById('alentours-liste');
  var elements = alentours.resultats;
  var typeInfo = TYPES.find(function(t){ return t.id === A.typeProjet; });
  var stList   = SOUS_TYPES[A.typeProjet] || [];
  var stInfo   = stList.find(function(s){ return s.id === A.sousType; });
  var label    = stInfo ? stInfo.label : (typeInfo ? typeInfo.label : 'Projet');

  /* Supprimer l'ancienne couche carte */
  if (alentours.layer) { A.carte.removeLayer(alentours.layer); alentours.layer = null; }

  /* Si aucun résultat */
  if (elements.length === 0) {
    liste.innerHTML =
      '<div class="al-empty">🔍 Aucun établissement du type<br/><strong>' + label + '</strong><br/>trouvé dans un rayon de ' +
      (alentours.rayon / 1000).toFixed(1).replace('.0','') + ' km.</div>';
    return;
  }

  /* Trier par distance */
  var enrichis = elements.map(function(el) {
    var lat = el.lat || (el.center && el.center.lat) || 0;
    var lng = el.lon || (el.center && el.center.lon) || 0;
    var dist = distanceKm(A.position.lat, A.position.lng, lat, lng);
    var nom  = el.tags && (el.tags.name || el.tags['name:fr']) || null;
    return { el: el, lat: lat, lng: lng, dist: dist, nom: nom };
  }).filter(function(e) { return e.lat !== 0; })
    .sort(function(a, b) { return a.dist - b.dist; });

  /* Limiter à 30 résultats */
  var affiches = enrichis.slice(0, 30);

  /* Badge compteur */
  liste.innerHTML =
    '<div class="al-count-badge">📍 ' + affiches.length +
    (enrichis.length > 30 ? '+' : '') +
    ' ' + label + ' dans un rayon de ' +
    (alentours.rayon / 1000).toFixed(1).replace('.0','') + ' km</div>';

  /* Créer la couche Leaflet */
  var markerGroup = L.layerGroup();

  affiches.forEach(function(item, idx) {
    var nom   = item.nom || label + ' #' + (idx + 1);
    var distStr = item.dist < 1
      ? Math.round(item.dist * 1000) + ' m'
      : item.dist.toFixed(1) + ' km';
    var type_detail = '';
    if (item.el.tags) {
      var t = item.el.tags;
      type_detail = t.amenity || t.shop || t.landuse || t.leisure || t.building || t.office || '';
    }

    /* Item panneau */
    var div = document.createElement('div');
    div.className = 'al-item';
    div.innerHTML =
      '<div class="al-item-dot"></div>' +
      '<div class="al-item-body">' +
        '<div class="al-item-nom">' + nom + '</div>' +
        (type_detail ? '<div class="al-item-meta">' + type_detail + '</div>' : '') +
        '<div class="al-item-dist">📍 ' + distStr + '</div>' +
      '</div>';

    /* Clic → centrer la carte sur cet item */
    (function(lat, lng, n) {
      div.addEventListener('click', function() {
        A.carte.setView([lat, lng], 16, { animate: true });
      });
    })(item.lat, item.lng, nom);

    liste.appendChild(div);

    /* Marqueur sur la carte */
    if (item.lat && item.lng) {
      var icon = L.divIcon({
        className: 'al-marker-label',
        html:
          '<div style="' +
            'background:#0369a1;' +
            'border:2px solid #fff;' +
            'border-radius:50%;' +
            'width:12px;height:12px;' +
            'box-shadow:0 1px 4px rgba(0,0,0,.4);' +
          '"></div>',
        iconSize:   [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([item.lat, item.lng], { icon: icon })
        .bindTooltip(
          '<b>' + nom + '</b>' +
          '<br/><small>' + distStr + ' de votre projet</small>',
          { className: 'commune-tooltip', direction: 'top' }
        )
        .addTo(markerGroup);
    }
  });

  alentours.layer = markerGroup.addTo(A.carte);
}

/* ── Affiche la section alentours après analyse ── */
function afficherAlentours() {
  document.getElementById('section-alentours').style.display = 'block';
  /* Réinitialiser pour relancer la recherche si sousType ou position ont changé */
  alentours.resultats = [];
  alentours.enCours   = false;
  /* Si le panneau était déjà ouvert, relancer la recherche */
  if (alentours.ouvert) {
    rechercherAlentours();
  }
}

/* ════════════════════════════════════════════════════════════════════
   DETECTION SPATIALE — Enjeux contextuels selon la localisation
   Teste si le point du projet est dans/près des polygones/points
   de COUCHES_DATA et injecte les enjeux correspondants.
   ════════════════════════════════════════════════════════════════════ */

/* Table de correspondance zone_type → enjeu contextuel */
var ENJEUX_CONTEXTUELS = {"ppri":{"label":"Zone inondable PPRi","rayon_m":0,"enjeu":{"id":"ctx-ppri","nom":"Zone inondable — PPRi applicable","ico":"🌊","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est localisé dans le périmètre d'un PPRi (Plan de Prévention du Risque Inondation)","Cours d'eau à réaction rapide lors des fontes de neige (tronçon vosgien)","85 communes du Territoire de Belfort concernées par le risque inondation"],"consequences":["Construction strictement interdite en zone rouge PPRi","Prescriptions obligatoires en zone bleue (plancher surélevé, matériaux résistants à l'eau)","Assurance habitation majorée, valeur vénale réduite","Permis refusé sans étude hydraulique si zone bleue du PPRi"]},"economique":{"facteurs":["Coût de mise en conformité aux prescriptions PPRi (surélévation, étanchéité)","Surprime d'assurance inondation : +20 à +50 % sur la durée","Valeur vénale du bien réduite si zone bleue PPRi connue"],"consequences":["Budget travaux majoré de 5 à 25 % selon les prescriptions","Impossibilité de financement bancaire en zone rouge","Coût des études hydrauliques : 3 000 à 15 000 €"]},"politique":{"facteurs":["PPRi Savoureuse, Bourbeuse ou Allaine : servitude d'utilité publique opposable","Consultation obligatoire du service risques de la DDT 90","Information Acquéreur Locataire (IAL) obligatoire"],"consequences":["Refus de permis en zone rouge sans dérogation préfectorale","Contentieux possible si information insuffisante de l'acquéreur","Délais d'instruction majorés : consultation SDIS et DDT"]},"social":{"facteurs":["Sécurité des futurs occupants en cas de crue","Expériences traumatiques des crues passées dans le 90","Plan Communal de Sauvegarde (PCS) de la commune"],"consequences":["Risque vital pour les occupants si crue soudaine (flash flood vosgien)","Stress et insécurité psychologique liés au risque permanent","Obligation d'information des occupants sur les consignes d'évacuation"]}},"actions":["Consulter le règlement PPRi en mairie AVANT toute démarche","Vérifier le classement de la parcelle : zone rouge (interdit), bleue (prescriptions), blanche (hors zone)","Réaliser une étude hydraulique si zone bleue ou limite de zone","Contacter la DDT 90 — service risques : 03 84 58 86 00"],"refs":[{"n":"C57","t":"Risque inondation"},{"n":"C58","t":"PPRi Savoureuse/Bourbeuse/Allaine"}]}},"azi":{"label":"Atlas Zones Inondables","rayon_m":0,"enjeu":{"id":"ctx-azi","nom":"Zone inondable — Atlas AZI","ico":"💧","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Localisation dans l'Atlas des Zones Inondables (AZI) de la Bourbeuse ou de la Douce","Zone non couverte par un PPRi mais soumise au risque inondation identifié"],"consequences":["Risque réel d'inondation même sans PPRi opposable","Obligation de prise en compte dans le PC (article R111-2 du Code de l'urbanisme)"]},"economique":{"facteurs":["Surprime d'assurance possible selon la déclaration de zone"],"consequences":["Valeur vénale potentiellement impactée si AZI mentionné dans l'état des risques"]},"politique":{"facteurs":["IAL obligatoire si commune listée dans l'arrêté préfectoral","Pas de PPRi mais le maire peut refuser sur R111-2"],"consequences":["Responsabilité du maire si construction autorisée dans une zone à risque connu"]},"social":{"facteurs":["Information des futurs occupants sur le risque identifié mais non réglementé"],"consequences":["Sentiment d'insécurité si la zone est régulièrement inondée en pratique"]}},"actions":["Consulter l'AZI à la DDT 90 ou sur Géorisques","Vérifier l'État des Risques et Pollutions (ERP) fourni par le vendeur","Prévoir des prescriptions constructives même sans PPRi opposable"],"refs":[{"n":"C57","t":"Risque inondation"},{"n":"C58","t":"AZI Bourbeuse/Douce"}]}},"sismique_3":{"label":"Zone sismicité 3 (modérée)","rayon_m":0,"enjeu":{"id":"ctx-sismique3","nom":"Risque sismique — Zone de sismicité 3","ico":"🏔","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Massif vosgien : zone de sismicité 3 (modérée) selon le zonage national","Séismes possibles avec dommages sur les structures légères"],"consequences":["Risque de dommages structurels en cas de séisme modéré","Fondations et structure à renforcer selon Eurocode 8"]},"economique":{"facteurs":["Surcoût de construction parasismique : +3 à +8 % du gros œuvre"],"consequences":["Obligation réglementaire générant un surcoût budgétaire","Économie à long terme sur les réparations post-séisme"]},"politique":{"facteurs":["Règles parasismiques (Eurocode 8) obligatoires pour les bâtiments neufs en zone 3","Catégories d'importance I à IV selon l'usage du bâtiment"],"consequences":["PC refusé si non-conformité aux règles parasismiques","Contrôle technique obligatoire pour les bâtiments en catégorie III et IV"]},"social":{"facteurs":["Sécurité des occupants en cas de secousse sismique","ERP et logements collectifs : risques amplifiés si structure inadaptée"],"consequences":["Protection de la vie humaine par les règles parasismiques","Responsabilité pénale du maître d'ouvrage si non-conformité"]}},"actions":["Vérifier la zone de sismicité et la catégorie d'importance du bâtiment","Appliquer l'Eurocode 8 et les règles PS 92 dès la conception","Recourir à un bureau de contrôle technique agréé pour les bâtiments sensibles"],"refs":[{"n":"C59","t":"Risque sismique — zones 2 et 3"}]}},"sismique_2":{"label":"Zone sismicité 2 (faible)","rayon_m":0,"enjeu":{"id":"ctx-sismique2","nom":"Risque sismique — Zone de sismicité 2","ico":"🏔","niv":"faible","tmin":2,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone de sismicité 2 (faible) : plaine de Belfort et plateaux jurassiens"],"consequences":["Risque limité mais non nul pour les bâtiments de catégorie III et IV"]},"economique":{"facteurs":["Surcoût parasismique limité en zone 2 (<2 % du gros œuvre)"],"consequences":["Impact budgétaire minimal mais obligatoire pour certaines catégories"]},"politique":{"facteurs":["Règles parasismiques applicables à partir de la catégorie d'importance II en zone 2"],"consequences":["ERP de grandes capacités et logements collectifs soumis aux règles parasismiques"]},"social":{"facteurs":["Risque résiduel faible pour les constructions légères"],"consequences":["Protection principalement pour les ERP et logements collectifs"]}},"actions":["Vérifier si la catégorie d'importance du bâtiment déclenche les règles parasismiques en zone 2","Consulter un bureau d'études structure pour les ERP et logements collectifs"],"refs":[{"n":"C59","t":"Risque sismique — zone 2"}]}},"mvt_terrain":{"label":"Aléa mouvement de terrain","rayon_m":0,"enjeu":{"id":"ctx-mvt-terrain","nom":"Mouvement de terrain — Versants vosgiens","ico":"⛰","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Versants vosgiens : aléa glissement de terrain, coulées boueuses, éboulements","Érosion accélérée lors des épisodes pluvieux intenses (changement climatique)"],"consequences":["Risque de destruction totale du bâti en cas de glissement majeur","Instabilité des fondations sur terrain en pente ou remblayé"]},"economique":{"facteurs":["Étude géotechnique G1+G2 obligatoire sur terrain en pente","Coût des confortements de pente : 20 000 à 200 000 €"],"consequences":["Renchérissement significatif si terrain nécessite des confortements","Assurance catastrophe naturelle possible si arrêté de CatNat"]},"politique":{"facteurs":["DDRM du 90 : risque mouvement de terrain identifié dans le secteur vosgien","Possible PPR mouvements de terrain si risque fort"],"consequences":["Le maire peut refuser sur R111-2 en zone à risque connu","Responsabilité engagée si construction autorisée sur terrain instable"]},"social":{"facteurs":["Sécurité des occupants sur les versants à forte pente","Accès aux secours difficile en cas d'événement sur versant"],"consequences":["Risque vital en cas de glissement rapide (non prévisible)","Traumatisme des populations exposées à des événements répétés"]}},"actions":["Commander une étude géotechnique G1 (investigation préliminaire) et G2 (avant projet) obligatoires","Consulter la carte des mouvements de terrain sur Géorisques (BRGM)","Contacter la DDT 90 pour vérifier si un PPR mouvements de terrain est applicable"],"refs":[{"n":"C60","t":"Aléa mouvements de terrain naturel"}]}},"argiles_moyen":{"label":"Zone argiles — aléa moyen","rayon_m":0,"enjeu":{"id":"ctx-argiles","nom":"Retrait-gonflement des argiles — Aléa moyen","ico":"🧱","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone d'exposition moyenne au retrait-gonflement des argiles (loi ELAN 2018)","Phénomène amplifié par les sécheresses successives (changement climatique)"],"consequences":["Fissuration des murs, décollement des façades, rupture des réseaux enterrés","Dommages estimés à 1,5 Md€/an en France, en hausse constante"]},"economique":{"facteurs":["Étude géotechnique G1+G2 obligatoire pour les maisons individuelles en zone argiles exposée (loi ELAN 2018)","Coût étude G2 : 3 000 à 8 000 €","Surcoût fondations adaptées : 5 000 à 20 000 €"],"consequences":["Obligation légale générant un surcoût budgétaire non négociable","Garantie décennale invalide si étude G2 absente sur zone exposée","Sinistres indemnisés via l'assurance catastrophe naturelle après arrêté préfectoral"]},"politique":{"facteurs":["Loi ELAN (2018) : étude G1+G2 obligatoire avant dépôt du PC en zone d'exposition moyenne ou forte","Arrêté de catastrophe naturelle (CatNat) requis pour l'indemnisation"],"consequences":["PC non instruit si étude absente en zone exposée","Responsabilité du constructeur engagée si mesures non respectées"]},"social":{"facteurs":["Impact psychologique sur les propriétaires face aux fissures progressives","Litige fréquent constructeur-propriétaire sur la responsabilité"],"consequences":["Stress et dévalorisation du bien résidentiel","Procédures longues (5 à 10 ans) pour l'indemnisation des sinistres argiles"]}},"actions":["Commander obligatoirement une étude G1 (Investigation préliminaire) et G2 (Avant projet) auprès d'un géotechnicien","Appliquer les mesures constructives : fondations ancrées sous la zone active, drainage périmétrique","Éviter les plantations gourmandes en eau à moins de 5 m du bâtiment","Consulter la carte BRGM argiles : argiles.fr"],"refs":[{"n":"C61","t":"Aléa retrait-gonflement argiles"}]}},"minier":{"label":"Zone de risque minier","rayon_m":200,"enjeu":{"id":"ctx-minier","nom":"Risque minier — Ancienne exploitation","ico":"⛏","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Présence de galeries minières anciennes sous-jacentes (mine de Giromagny et environs)","Risque d'effondrement différé des terrains superficiels"],"consequences":["Fontis (effondrement localisé soudain) possible sans signe précurseur","Contamination possible des sols et eaux souterraines par les résidus miniers"]},"economique":{"facteurs":["Étude de dangers miniers obligatoire avant tout projet de construction","Coût d'investigation et de confortement des galeries : 50 000 à 500 000 €"],"consequences":["Renchérissement majeur du projet voire impossibilité de construire","Responsabilité de l'État via le BRGM si mineur défaillant ou inconnu"]},"politique":{"facteurs":["Code minier : obligations d'information et de surveillance des anciens sites","BRGM : base de données des anciens travaux miniers (Géorisques)","Déclaration de sinistre minier possible auprès de la DREAL"],"consequences":["Refus de permis si galeries avérées sous l'emprise du projet","Enquête publique si mesures de confortement importantes"]},"social":{"facteurs":["Mémoire minière du territoire (mine de Giromagny — plomb et zinc)","Risque vital en cas d'effondrement brutal d'une galerie"],"consequences":["Anxiété des riverains vivant au-dessus de galeries connues","Patrimoine industriel minier à valoriser culturellement"]}},"actions":["Consulter la base GDM (Géorisques — données minières) avant tout achat","Contacter le BRGM pour une étude de dangers miniers","Vérifier l'Arrêté de Risque Minier (ARM) de la commune auprès de la préfecture"],"refs":[{"n":"C62","t":"Risque minier — mine de Giromagny"}]}},"feux_foret":{"label":"Aléa feux de forêt","rayon_m":0,"enjeu":{"id":"ctx-feux-foret","nom":"Risque feux de forêt — Zone forestière vosgienne","ico":"🔥","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone forestière vosgienne : risque feux de végétation en hausse (changement climatique)","Sécheresses estivales de plus en plus fréquentes dans la région BFC"],"consequences":["Destruction possible du bâtiment si feu de forêt à proximité immédiate","Dégradation de la biodiversité forestière après incendie"]},"economique":{"facteurs":["Débroussaillement obligatoire jusqu'à 50 m autour des constructions en zone classée","Surpoprime d'assurance incendie en zone boisée"],"consequences":["Coût annuel de débroussaillement : 500 à 2 000 € selon la surface","Obligation de débroussaillement pour les propriétaires, sous peine d'amende"]},"politique":{"facteurs":["Code forestier : Obligation Légale de Débroussaillement (OLD) en zones à risque","SDIS 90 : intervention difficile en zone forestière éloignée","DDRM du 90 : risque feux de forêt identifié dans le massif vosgien"],"consequences":["OLD opposable au propriétaire, exécutable d'office par la commune si non respectée","PC possible si distance minimale aux peuplements forestiers respectée"]},"social":{"facteurs":["Proximité des habitations isolées en lisière de forêt (hameaux vosgiens)","Évacuation difficile en cas de feu rapide sur versant"],"consequences":["Risque vital pour les habitants en cas de propagation rapide","Isolement des hameaux vosgiens si routes coupées par un incendie"]}},"actions":["Vérifier si la commune est classée en zone à risque feux de forêt (arrêté préfectoral)","Respecter l'Obligation Légale de Débroussaillement (50 m autour des constructions)","Contacter le SDIS 90 pour les prescriptions d'accès pompiers","Prévoir une réserve d'eau (citerne) si zone isolée du réseau"],"refs":[{"n":"C63","t":"Aléa feux de forêts"}]}},"radon":{"label":"Zone potentiel radon élevé","rayon_m":0,"enjeu":{"id":"ctx-radon","nom":"Risque Radon — Zone granite vosgien","ico":"☢","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Sous-sol granitique vosgien : émissions naturelles de radon plus élevées","Gaz radioactif naturel, inodore, issu de la désintégration de l'uranium et du radium","Concentration variable selon la porosité du sol, la ventilation du bâtiment"],"consequences":["2e cause de mortalité par cancer du poumon en France (3 000 décès/an)","Accumulation dans les sous-sols et vides sanitaires mal ventilés"]},"economique":{"facteurs":["Coût d'un détecteur radon : 50 à 200 €","Coût d'une membrane anti-radon à la construction : 1 000 à 5 000 €","VMC double flux recommandée : 3 000 à 8 000 €"],"consequences":["Surcoût modéré si mesures intégrées dès la conception","Coût de remédiation a posteriori beaucoup plus élevé (10 000 à 30 000 €)"]},"politique":{"facteurs":["Arrêté du 27 juin 2018 : niveau de référence à 300 Bq/m³","ERP : mesures obligatoires si niveau > 300 Bq/m³ (catégories 1 à 4)","Cartographie radon disponible par commune (IRSN)"],"consequences":["Obligation de mesure et d'action pour les ERP en zone à potentiel radon","Responsabilité du propriétaire si taux dépasse le seuil réglementaire"]},"social":{"facteurs":["Risque sanitaire peu connu du grand public","Exposition longue durée sans symptômes immédiats (cancer à long terme)"],"consequences":["Sensibilisation nécessaire des propriétaires et occupants","Droit à l'information des occupants sur le niveau radon mesuré"]}},"actions":["Installer un détecteur radon passif pendant 3 à 12 mois (IRSN recommande l'hiver)","Intégrer une membrane anti-radon sous dallage dès la construction","Installer une VMC double flux ou ventilation mécanique efficace","Consulter la carte radon par commune sur le site de l'IRSN"],"refs":[{"n":"C64","t":"Risque Radon"}]}},"natura2000":{"label":"Zone Natura 2000","rayon_m":0,"enjeu":{"id":"ctx-natura2000","nom":"Natura 2000 — Evaluation d'incidences obligatoire","ico":"🦋","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet dans ou à proximité d'un site Natura 2000 (ZSC ou ZPS)","Habitats et espèces d'intérêt communautaire potentiellement impactés","Massif vosgien : habitats forestiers et tourbières d'importance européenne"],"consequences":["Evaluation d'incidences Natura 2000 obligatoire (article L414-4 Code environnement)","Risque de refus si incidences significatives non compensées","Mesures ERC imposées pouvant représenter 5 à 20 % du coût total"]},"economique":{"facteurs":["Coût de l'évaluation d'incidences : 5 000 à 50 000 € selon la complexité","Mesures compensatoires si incidences résiduelles significatives"],"consequences":["Budget d'études majoré de 2 à 8 %","Allongement des délais d'instruction : 3 à 12 mois supplémentaires","Recours juridiques fréquents des associations de protection de la nature"]},"politique":{"facteurs":["DOCOB (Document d'Objectifs) du site Natura 2000 applicable","Instruction par la DDT 90 avec avis de la DREAL BFC","Contentieux administratif possible si évaluation insuffisante"],"consequences":["Annulation du PC par le tribunal administratif si évaluation manquante","Délais allongés : la DREAL BFC a 2 mois pour émettre son avis"]},"social":{"facteurs":["Valeur patrimoniale et identitaire des espaces naturels protégés","Tourisme vert lié à la qualité des milieux naturels vosgiens"],"consequences":["Opposition des associations naturalistes si impacts non justifiés","Valorisation touristique préservée si projet compatible avec Natura 2000"]}},"actions":["Réaliser une évaluation préliminaire d'incidences Natura 2000 dès l'avant-projet","Consulter le DOCOB du site concerné (DDT 90 ou site internet de la DREAL BFC)","Contacter la DDT 90 pour un cadrage préalable de l'évaluation","Vérifier si des contrats Natura 2000 peuvent s'appliquer au projet"],"refs":[{"n":"C52","t":"Protection patrimoine naturel"},{"n":"C55","t":"Inventaire patrimoine naturel"}]}},"znieff1":{"label":"ZNIEFF de type I","rayon_m":100,"enjeu":{"id":"ctx-znieff1","nom":"ZNIEFF type I — Zone naturelle d'intérêt écologique fort","ico":"🌿","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["ZNIEFF de type I : zone à forte valeur écologique, espèces rares ou menacées","Habitats naturels remarquables identifiés par l'inventaire national"],"consequences":["Obligation d'inventaires naturalistes complets (4 saisons minimum)","Risque de découverte d'espèces protégées nécessitant une dérogation CNPN"]},"economique":{"facteurs":["Coût des inventaires : 15 000 à 60 000 €","Dérogation espèces protégées (CNPN) : délais de 6 à 18 mois supplémentaires"],"consequences":["Allongement du calendrier et surcoût d'études significatif","Risque d'annulation du projet si impact résiduel non compensable"]},"politique":{"facteurs":["ZNIEFF n'est pas une protection réglementaire directe mais est fortement opposable","Jurisprudence : le juge administratif tient compte des ZNIEFF dans ses décisions"],"consequences":["Le PC peut être annulé si une ZNIEFF I est impactée sans évaluation sérieuse","Avis de la DREAL BFC systématiquement sollicité"]},"social":{"facteurs":["Valeur patrimoniale des espèces et habitats identifiés dans la ZNIEFF"],"consequences":["Opposition forte des associations naturalistes si ZNIEFF impactée"]}},"actions":["Commander des inventaires faune-flore sur 4 saisons avant tout dépôt","Éviter l'emprise sur la ZNIEFF si possible (variante de moindre impact)","Contacter la DREAL BFC pour un cadrage naturaliste préalable"],"refs":[{"n":"C55","t":"Inventaire patrimoine naturel"},{"n":"C52","t":"Protection C52"}]}},"znieff2":{"label":"ZNIEFF de type II","rayon_m":0,"enjeu":{"id":"ctx-znieff2","nom":"ZNIEFF type II — Grand ensemble naturel","ico":"🌲","niv":"moyen","tmin":2,"contexte_zone":true,"axes":{"environnement":{"facteurs":["ZNIEFF de type II : grand ensemble naturel à enjeu de biodiversité","Cohérence écologique à préserver à l'échelle du massif vosgien"],"consequences":["Inventaires naturalistes recommandés (2 saisons minimum)","Mesures d'intégration écologique du projet attendues"]},"economique":{"facteurs":["Coût d'inventaires allégés : 5 000 à 25 000 €"],"consequences":["Impact budgétaire modéré mais anticipation recommandée"]},"politique":{"facteurs":["ZNIEFF II : signal d'alerte pour le juge administratif en cas de recours"],"consequences":["Instruction renforcée si projet significatif dans une ZNIEFF II"]},"social":{"facteurs":["Cadre de vie naturel valorisé par les habitants du massif vosgien"],"consequences":["Attentes fortes des riverains sur la préservation du cadre naturel"]}},"actions":["Réaliser des inventaires naturalistes de printemps et d'été a minima","Intégrer des mesures d'évitement et de réduction dans la conception du projet"],"refs":[{"n":"C55","t":"Inventaire patrimoine naturel"}]}},"reservoir":{"label":"Réservoir de biodiversité TVB","rayon_m":0,"enjeu":{"id":"ctx-reservoir-tvb","nom":"Trame Verte — Réservoir de biodiversité","ico":"🌳","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet dans un réservoir de biodiversité de la Trame Verte (massifs vosgiens ou jurassiens)","Concentration d'espèces et d'habitats servant de source pour les corridors écologiques"],"consequences":["Fragmentation irréversible d'un réservoir clé si emprise significative","Obligation d'évaluation complète de la TVB dans les documents d'urbanisme"]},"economique":{"facteurs":["Mesures compensatoires TVB si fragmentation avérée","Coût des inventaires et de l'évaluation TVB : 10 000 à 40 000 €"],"consequences":["Compensation à ratio élevé si réservoir fragmenté (ratio 300 % possible)"]},"politique":{"facteurs":["SRCE BFC : préservation des réservoirs de biodiversité obligatoire","SCoT du 90 : déclinaison locale du SRCE"],"consequences":["Refus possible si projet fragmentant significativement un réservoir TVB"]},"social":{"facteurs":["Services écosystémiques rendus par les réservoirs (eau, air, loisirs)"],"consequences":["Dépréciation des services écosystémiques si réservoir dégradé"]}},"actions":["Identifier précisément les limites du réservoir TVB sur la carte SRCE BFC","Proposer une variante évitant le réservoir ou réduisant l'emprise au strict minimum","Contacter la DDT 90 service biodiversité pour un cadrage préalable"],"refs":[{"n":"C53","t":"Trame verte"},{"n":"C54","t":"Trame bleue"}]}},"foret":{"label":"Massif forestier","rayon_m":0,"enjeu":{"id":"ctx-foret","nom":"Couverture forestière — Défrichement soumis à autorisation","ico":"🌲","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet dans une zone forestière (43 % du territoire du 90 est boisé)","Défrichement soumis à autorisation préfectorale (Code forestier)","Impact carbone : 1 ha de forêt = 80 à 200 tCO2 stockées"],"consequences":["Perte de stockage carbone et de services écosystémiques forestiers","Compensation forestière obligatoire si défrichement autorisé (ratio 1:2 à 1:5)"]},"economique":{"facteurs":["Coût de la compensation forestière : 3 000 à 15 000 €/ha","Délai d'instruction de l'autorisation de défrichement : 3 à 6 mois"],"consequences":["Surcoût et délai si défrichement nécessaire","Valeur forestière à déduire du prix de vente ou à compenser"]},"politique":{"facteurs":["Code forestier L341-1 : autorisation de défrichement obligatoire pour les bois > 0,5 ha","Instruction par la DDT 90 service forêt","Compensation forestière fixée par l'arrêté d'autorisation"],"consequences":["Refus possible si forêt de protection ou forêt domaniale","Obligation de reboisement compensateur si autorisation accordée"]},"social":{"facteurs":["Forêt vosgienne : espace de loisirs et d'identité pour les habitants","Emplois dans la filière bois locale (sylviculture, scieries)"],"consequences":["Opposition possible des riverains si défrichement visible","Impact sur le tourisme vert lié à la forêt vosgienne"]}},"actions":["Déposer une demande d'autorisation de défrichement à la DDT 90 si surface > 0,5 ha","Contacter l'ONF ou le CRPF selon le statut de la forêt (publique/privée)","Prévoir une compensation forestière dans le budget du projet"],"refs":[{"n":"C57","t":"Couverture forestière"}]}},"zone_humide":{"label":"Zone humide probable","rayon_m":0,"enjeu":{"id":"ctx-zone-humide","nom":"Zone humide — Loi sur l'eau et compensation","ico":"🦆","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet dans une zone humide probable (carte DDT 90 — Atlas C46)","Zones humides : stockage carbone, régulation des crues, biodiversité exceptionnelle","50 % des zones humides françaises détruites depuis 1960"],"consequences":["Impact sur les services écosystémiques : régulation hydrique, épuration, biodiversité","Compensation à ratio 150 à 200 % minimum si destruction inévitable","Procédure IOTA longue si surface > 1 ha"]},"economique":{"facteurs":["Délimitation précise : sondages pédologiques + relevés floristiques (3 000 à 10 000 €)","Dossier IOTA (déclaration ou autorisation) : 5 000 à 30 000 €","Compensation : acquisition et restauration de zones humides (ratio 150 à 200 %)"],"consequences":["Renchérissement significatif si zone humide avérée dans l'emprise","Projet à requalifier ou déplacer si coût de compensation prohibitif"]},"politique":{"facteurs":["Loi sur l'eau (IOTA) : déclaration si 0,1 à 1 ha, autorisation si > 1 ha","Instruction par la DDT 90 service eau","Séquence ERC obligatoire : éviter en priorité"],"consequences":["Refus possible si zone humide de grand intérêt écologique et alternative existante","Enquête publique si autorisation IOTA requise"]},"social":{"facteurs":["Rôle tampon des zones humides contre les inondations : protège les riverains","Biodiversité des zones humides : richesse patrimoniale locale"],"consequences":["Aggravation des inondations en aval si zone humide détruite","Opposition des associations si zone humide détruite sans compensation sérieuse"]}},"actions":["Faire délimiter précisément la zone humide par un bureau d'études agréé (sondages + flore)","Éviter l'emprise sur la zone humide (implantation alternative)","Si destruction inévitable : déposer un dossier IOTA à la DDT 90 avec mesures compensatoires","Contacter l'Agence de l'eau RMC pour un financement de la compensation"],"refs":[{"n":"C46","t":"Zones humides probables"},{"n":"C43","t":"SAGE Allan"}]}},"nitrates":{"label":"Zone vulnérable aux nitrates","rayon_m":0,"enjeu":{"id":"ctx-nitrates","nom":"Zone vulnérable nitrates — Programme d'action","ico":"🌱","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone vulnérable aux nitrates : pollution des eaux souterraines et de surface par l'agriculture","Bassin versant de l'Allan ou Bourbeuse : eaux sensibles à l'eutrophisation"],"consequences":["Risque de contamination du captage AEP en aval si bonnes pratiques non respectées","Prolifération algale dans les cours d'eau si nitrates excessifs"]},"economique":{"facteurs":["Programme d'actions nitrates : contraintes d'épandage et de stockage","Coût de mise en conformité des stockages d'effluents : 10 000 à 50 000 €"],"consequences":["Surcoût opérationnel pour les exploitants agricoles en zone vulnérable","Aide MAEC possible pour les pratiques vertueuses : 80 à 160 €/ha"]},"politique":{"facteurs":["Directive Nitrates (1991) : programme d'actions régional opposable","Contrôle DDT 90 dans le cadre de la conditionnalité renforcée PAC 2023","Arrêté préfectoral annuel fixant les périodes d'épandage interdites"],"consequences":["Sanction PAC si non-respect des BCAE (réduction des paiements directs)","Mise en demeure si pollution grave avérée"]},"social":{"facteurs":["Qualité de l'eau potable pour les habitants du bassin versant","Initiative 'L'Eau d'Ici' (CCST) : coopération agriculteurs-collectivités"],"consequences":["Confiance des consommateurs dans l'eau du robinet locale","Coopération renforcée si agriculteurs engagés dans des démarches collectives"]}},"actions":["Vérifier la localisation en zone vulnérable (DDT 90 ou carte interactive Géoportail)","Respecter le 5e programme d'actions nitrates : périodes d'épandage, doses, stockages","Adhérer à la démarche 'L'Eau d'Ici' (CCST) pour un accompagnement personnalisé","Contacter la Chambre d'Agriculture 90 pour le plan de fumure"],"refs":[{"n":"C40","t":"Zones vulnérables nitrates"},{"n":"C48","t":"Prélèvements eau"}]}},"sage":{"label":"Périmètre SAGE Allan","rayon_m":0,"enjeu":{"id":"ctx-sage","nom":"SAGE Allan — Schéma d'Aménagement et Gestion des Eaux","ico":"💧","niv":"moyen","tmin":2,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet dans le périmètre du SAGE Allan (couvre tout le Territoire de Belfort)","Objectifs DCE : 15 % seulement des masses d'eau en bon état écologique dans le 90"],"consequences":["Obligation de compatibilité du projet avec les orientations du SAGE","Vigilance sur les rejets, prélèvements et imperméabilisation"]},"economique":{"facteurs":["Etudes hydrauliques si projet proche d'un cours d'eau (IOTA)","Financement possible par l'Agence de l'eau RMC si projet de restauration"],"consequences":["Dossier loi sur l'eau potentiellement requis selon l'impact hydraulique"]},"politique":{"facteurs":["SAGE approuvé : règlement opposable aux tiers","Commission Locale de l'Eau (CLE) : instance de gouvernance du SAGE Allan"],"consequences":["Compatibilité du PLU et des PC avec le SAGE Allan obligatoire"]},"social":{"facteurs":["Gestion transfrontalière de l'eau (Suisse, Doubs, Haut-Rhin)"],"consequences":["Coopération internationale indispensable pour l'état des masses d'eau"]}},"actions":["Vérifier la compatibilité du projet avec les orientations du SAGE Allan (DDT 90)","Contacter la CLE (Commission Locale de l'Eau) pour les projets impactant les cours d'eau","Déposer un dossier IOTA si le projet affecte le régime hydraulique"],"refs":[{"n":"C43","t":"SAGE Allan"},{"n":"C44","t":"Etat écologique masses eau"}]}},"captage_aep":{"label":"Captage AEP","rayon_m":500,"enjeu":{"id":"ctx-captage-aep","nom":"Captage AEP — Périmètre de protection","ico":"🚰","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet à proximité d'un captage d'alimentation en eau potable","Périmètre de protection immédiate (PPI), rapprochée (PPR) ou éloignée (PPE) possible"],"consequences":["Activités interdites ou restreintes dans les périmètres de protection","Pollution accidentelle pouvant rendre le captage non conforme"]},"economique":{"facteurs":["Coût de dépollution d'un captage contaminé : plusieurs millions €","Restrictions pouvant rendre le projet non réalisable dans le PPI"],"consequences":["Projet incompatible avec le PPI : refus systématique","Prescriptions spéciales dans le PPR : surcoût de 5 à 15 %"]},"politique":{"facteurs":["Périmètres de protection définis par arrêté préfectoral (Code de la santé publique)","Consultation ARS BFC obligatoire pour les projets dans les périmètres","Hydrogéologue agréé requis pour les études"],"consequences":["Refus systématique dans le PPI et les PPR pour les activités polluantes","Déclaration d'utilité publique protège le captage contre les activités incompatibles"]},"social":{"facteurs":["Santé publique : qualité de l'eau du robinet pour les habitants raccordés au captage"],"consequences":["Coupure d'eau potable si captage contaminé (impact sur toute la commune)"]}},"actions":["Identifier le captage le plus proche et ses périmètres de protection (DDT 90 ou ARS BFC)","Consulter l'ARS BFC avant tout projet dans un périmètre de protection","Éviter toute activité polluante dans le PPR sans étude hydrogéologique préalable"],"refs":[{"n":"C48","t":"Prélèvements eau et captages AEP"}]}},"perimetre_MH":{"label":"Périmètre MH 500m","rayon_m":0,"enjeu":{"id":"ctx-mh-perimetre","nom":"Monument Historique — Avis conforme ABF obligatoire","ico":"🏛","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet dans le périmètre de protection de 500 m d'un Monument Historique (classé ou inscrit)","Covisibilité possible avec la Citadelle Vauban ou le Lion de Belfort"],"consequences":["Modification du paysage patrimonial si projet mal intégré","Obligation de respecter les prescriptions architecturales de l'ABF"]},"economique":{"facteurs":["Coût d'un architecte du patrimoine recommandé : +5 à +15 % des honoraires","Prescriptions ABF pouvant imposer des matériaux traditionnels plus coûteux"],"consequences":["Surcoût architectural si matériaux ou formes spécifiques imposés","Valorisation patrimoniale du bien si intégration réussie"]},"politique":{"facteurs":["Avis conforme de l'ABF (UDAP 90) obligatoire : son refus bloque le PC","Architecte des Bâtiments de France (ABF) : pouvoir discrétionnaire sur l'intégration","Recours possible auprès du préfet de région si désaccord avec l'ABF"],"consequences":["PC refusé si l'ABF émet un avis défavorable (avis conforme)","Délai d'instruction majoré : l'ABF a 2 mois pour rendre son avis","Modification imposée du projet (hauteur, matériaux, couleurs, toiture)"]},"social":{"facteurs":["Patrimoine architectural belfortain : identité culturelle forte","Tourisme patrimonial lié à la Citadelle Vauban (site majeur)"],"consequences":["Préservation de la qualité paysagère appréciée par les habitants","Cohérence architecturale du centre historique de Belfort"]}},"actions":["Prendre rendez-vous avec l'UDAP 90 (ABF) en amont du dépôt du PC","Consulter les prescriptions architecturales locales (AVAP, PSMV si applicables)","Faire appel à un architecte du patrimoine pour la conception","UDAP 90 : 03 84 28 70 01 — udap-90@culture.gouv.fr"],"refs":[{"n":"C88","t":"Monuments historiques"},{"n":"C90","t":"Archéologie préventive"}]}},"MH_classe":{"label":"Monument Historique classé","rayon_m":500,"enjeu":{"id":"ctx-mh-classe","nom":"Monument Historique classé — Protection renforcée","ico":"🏰","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Proximité immédiate d'un Monument Historique classé","Covisibilité directe potentielle avec le monument"],"consequences":["Contraintes architecturales maximales imposées par l'ABF","Valorisation paysagère possible si projet de qualité"]},"economique":{"facteurs":["Contraintes architecturales imposant des matériaux nobles","Valorisation patrimoniale du bien bien intégré"],"consequences":["Surcoût de construction si prescriptions ABF strictes","Plus-value patrimoniale à long terme si intégration réussie"]},"politique":{"facteurs":["Avis conforme ABF = pouvoir de blocage absolu du projet","Recours préfet possible si avis ABF disproportionné"],"consequences":["Blocage du projet possible si ABF émet un avis défavorable non motivé"]},"social":{"facteurs":["Symbole identitaire fort (Citadelle Vauban = carte postale de Belfort)"],"consequences":["Réaction sociale forte si projet perçu comme dégradant le monument"]}},"actions":["Rencontrer l'ABF en phase esquisse, avant tout dépôt","Proposer une intégration architecturale soignée et documentée","Viser la labellisation 'Architecture remarquable' si le projet l'y prête"],"refs":[{"n":"C88","t":"Monuments historiques"}]}},"zppa":{"label":"Zone de Présomption Archéologique","rayon_m":0,"enjeu":{"id":"ctx-zppa","nom":"Archéologie préventive — ZPPA applicable","ico":"🏺","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Projet dans une Zone de Présomption de Prescription Archéologique (ZPPA)","Vestiges archéologiques potentiels dans le sous-sol"],"consequences":["Découverte fortuite de vestiges pouvant stopper le chantier","Obligation de préserver les éléments archéologiques découverts"]},"economique":{"facteurs":["Diagnostic archéologique préventif : 5 000 à 30 000 € (financé en partie par l'aménageur)","Fouille archéologique si vestiges significatifs : 50 000 à plusieurs centaines de milliers d'€"],"consequences":["Délai supplémentaire de 3 à 18 mois si fouilles requises","Coût imprévisible si vestiges importants découverts"]},"politique":{"facteurs":["Loi 2001-44 : archéologie préventive obligatoire dans les ZPPA","Instruction par la DRAC BFC (Direction Régionale des Affaires Culturelles)","Prescriptions émises par le Préfet de région"],"consequences":["PC assorti d'une prescription archéologique préalable aux travaux","Arrêt de chantier obligatoire en cas de découverte fortuite"]},"social":{"facteurs":["Patrimoine archéologique local : voie romaine, vestiges médiévaux","Valorisation possible des découvertes dans un musée local"],"consequences":["Intérêt scientifique et culturel des fouilles pour le territoire","Retards de chantier vécus négativement par les riverains et le maître d'ouvrage"]}},"actions":["Déclarer le projet à la DRAC BFC dès le dépôt du PC si en ZPPA","Anticiper un délai supplémentaire de 3 à 6 mois pour le diagnostic","Prévoir une provision pour fouilles dans le budget : 5 % du coût de construction minimum"],"refs":[{"n":"C90","t":"Archéologie préventive"}]}},"zone_AU":{"label":"Zone d'urbanisation future (AU)","rayon_m":0,"enjeu":{"id":"ctx-zone-au","nom":"Zone AU — Conditions d'ouverture à l'urbanisation","ico":"📋","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone AU : secteur naturel ou agricole ouvert progressivement à l'urbanisation","Conditions d'ouverture : viabilisation des réseaux, compatibilité SCoT"],"consequences":["Consommation foncière comptabilisée dans les objectifs ZAN","Obligation de gestion des eaux pluviales à la source dès la création de la zone"]},"economique":{"facteurs":["Coût de viabilisation d'une zone AU : 50 000 à 200 000 €/ha","Charges de viabilisation pesant sur l'aménageur ou la collectivité"],"consequences":["Budget de viabilisation à intégrer dans le bilan de l'opération","Possibilité de mutualisation avec d'autres opérations dans la zone"]},"politique":{"facteurs":["Zone 1AU : ouverte à l'urbanisation si réseaux suffisants","Zone 2AU : réservée, ouverture conditionnée à la révision du PLU","Modification ou révision du PLU si zone 2AU"],"consequences":["Délai de 6 à 24 mois si révision du PLU nécessaire pour ouvrir une 2AU","PC refusé en zone 2AU sans modification préalable du PLU"]},"social":{"facteurs":["Développement contrôlé et planifié du territoire","Accueil de nouveaux habitants et maintien des services de proximité"],"consequences":["Attractivité résidentielle renforcée si zone AU bien localisée","Tensions foncières possibles si rareté des zones AU disponibles"]}},"actions":["Vérifier si la zone AU est de type 1AU (opérable) ou 2AU (bloquée)","Contacter le service urbanisme de la mairie ou de l'EPCI compétent","Anticiper les délais si révision du PLU nécessaire"],"refs":[{"n":"C65","t":"Documents urbanisme"},{"n":"C69","t":"Sobriété foncière"}]}},"friche":{"label":"Friche inventoriée","rayon_m":100,"enjeu":{"id":"ctx-friche-proche","nom":"Friche à proximité — Opportunité de recyclage foncier","ico":"♻","niv":"faible","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Friche industrielle ou commerciale proche du projet","Opportunité de recyclage foncier préférable à l'extension sur terrain vierge (ZAN)"],"consequences":["Choix de la friche = consommation ZAN nulle","Possible pollution à diagnostiquer avant reconversion"]},"economique":{"facteurs":["Fonds Friches ADEME : financement du différentiel de coût friche vs terrain vierge"],"consequences":["Coût global potentiellement comparable si Fonds Friches obtenu"]},"politique":{"facteurs":["Loi ZAN : obligation de justifier l'absence d'alternative sur friche avant extension"],"consequences":["Argument fort en instruction si friche disponible non utilisée"]},"social":{"facteurs":["Requalification urbaine bénéfique pour le quartier"],"consequences":["Amélioration de l'image et du cadre de vie si friche reconvertie"]}},"actions":["Consulter le portail BIGAN de la DDT 90 pour l'inventaire des friches","Evaluer si la friche proche est mobilisable avant de choisir un terrain vierge","Contacter l'EPF BFC pour le portage foncier de la friche"],"refs":[{"n":"C70","t":"Réhabilitation friches"},{"n":"C71","t":"Friches dans le 90"}]}},"bruit_1":{"label":"Secteur bruit catégorie 1","rayon_m":0,"enjeu":{"id":"ctx-bruit","nom":"Nuisances sonores — Secteur affecté par le bruit des transports","ico":"🔊","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Secteur classé au bruit des infrastructures de transport (cat. 1 à 5)","A36 : infrastructure de catégorie 1 (>100 000 veh/j) — secteur de 300 m"],"consequences":["Niveaux de bruit importants : Lden > 65 dB(A) dans les secteurs les plus exposés","Impact sur la santé et la qualité de vie des futurs occupants"]},"economique":{"facteurs":["Isolation acoustique renforcée obligatoire : DnT,A ≥ 40 dB(A) en cat. 1","Surcoût isolation acoustique : 5 000 à 20 000 € selon la surface"],"consequences":["Renchérissement du projet par l'isolation acoustique renforcée","Valeur vénale réduite si bruit perceptible malgré l'isolation"]},"politique":{"facteurs":["Classement sonore opposable : arrêté préfectoral annexé au PLU","Attestation acoustique obligatoire à joindre au PC pour les logements","Norme NF S 31-010 et arrêté du 25 avril 2003"],"consequences":["PC refusé si attestation acoustique manquante","Réception de chantier conditionnée aux mesures acoustiques in situ"]},"social":{"facteurs":["Exposition chronique au bruit : effets néfastes sur la santé (OMS : > 65 dB(A) = risque cardiaque)","Confort acoustique des occupants : facteur de qualité de vie majeur"],"consequences":["Perturbation du sommeil, stress, troubles cardiovasculaires si exposition chronique","Obligation d'information des futurs acquéreurs sur le classement sonore"]}},"actions":["Vérifier le classement sonore de la rue (annexe PLU ou DDT 90)","Faire réaliser une étude acoustique par un bureau agréé dès l'avant-projet","Prévoir une orientation des pièces de vie côté calme (loin de la voie bruyante)","Intégrer les éléments acoustiques dans le dossier PC (attestation obligatoire)"],"refs":[{"n":"C84","t":"Carte stratégique bruit"},{"n":"C85","t":"Classement sonore"}]}},"trafic_fort":{"label":"Axe à fort trafic (>20 000 veh/j)","rayon_m":100,"enjeu":{"id":"ctx-trafic-fort","nom":"Axe à fort trafic — Pollution air et bruit","ico":"🚛","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Axe routier à trafic très important (>20 000 veh/j) à proximité immédiate","Emissions de NO2, PM10, PM2.5 en quantités significatives"],"consequences":["Zone de dépassement potentiel des valeurs limites de qualité de l'air","Aggravation des problèmes respiratoires pour les occupants exposés"]},"economique":{"facteurs":["Systèmes de ventilation et filtration de l'air recommandés","VMC double flux avec filtre HEPA recommandée"],"consequences":["Surcoût ventilation : 3 000 à 8 000 €","Valeur vénale impactée par la pollution atmosphérique et le bruit"]},"politique":{"facteurs":["Carte Stratégique de l'Air (ATMO BFC) : diagnostic de la qualité de l'air","Plan de Protection de l'Atmosphère (PPA) BFC si zone de dépassement"],"consequences":["Obligation d'information sur la qualité de l'air dans certaines communes","Restriction possible des activités polluantes si PPA applicable"]},"social":{"facteurs":["Exposition quotidienne à la pollution de l'air pour les riverains","Pédestrians, cyclistes et résidents les plus exposés"],"consequences":["Risques respiratoires et cardiovasculaires pour les populations exposées","Inégalités sociales d'exposition (logements sociaux souvent près des axes"]}},"actions":["Consulter la Carte Stratégique de l'Air d'ATMO BFC pour l'adresse exacte","Installer une VMC double flux avec filtration en cas de fort trafic proche","Orienter les chambres et espaces de vie côté opposé à l'axe routier"],"refs":[{"n":"C18","t":"Qualité de l'air"},{"n":"C82","t":"Flux véhicules"},{"n":"C84","t":"Bruit stratégique"}]}},"qpv":{"label":"Quartier Prioritaire de la Ville","rayon_m":0,"enjeu":{"id":"ctx-qpv","nom":"Quartier Prioritaire (QPV) — Politique de la ville","ico":"🏘","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone urbaine dense à potentiel de renouvellement urbain (QPV)","Enjeux de désimperméabilisation et de végétalisation dans les QPV belfortains"],"consequences":["Opportunité de renaturation et d'amélioration du cadre de vie","Potentiel de Fonds vert (volet cadre de vie) pour les projets de renouvellement"]},"economique":{"facteurs":["Aides spécifiques ANRU (Agence Nationale Rénovation Urbaine) dans les QPV","Exonérations fiscales ZFU-TE possibles pour les entreprises en QPV"],"consequences":["Financement ANRU possible si projet de rénovation urbaine","Attractivité commerciale réduite si QPV stigmatisé"]},"politique":{"facteurs":["7 QPV dans le Territoire de Belfort (révision 2024) — 15 200 habitants concernés","Contrats de ville : gouvernance multi-acteurs (État, EPCI, associations)","Programme ANRU : rénovation urbaine des QPV"],"consequences":["Financements dédiés accessibles si projet cohérent avec le contrat de ville","Concertation avec les habitants du QPV obligatoire pour les projets ANRU"]},"social":{"facteurs":["Populations confrontées aux inégalités sociales et économiques","Forte densité, mixité sociale à renforcer","Besoin en équipements, services de proximité et espaces verts"],"consequences":["Amélioration de la qualité de vie si projet bien conçu et concerté","Risque de gentrification si rénovation sans logement social maintenu"]}},"actions":["Contacter le service politique de la ville de Grand Belfort pour les financements ANRU","Intégrer une démarche de concertation avec les habitants du QPV","Vérifier si le projet est éligible au Fonds vert volet cadre de vie"],"refs":[{"n":"C80","t":"Quartiers prioritaires de la ville"}]}},"eolien_etude":{"label":"Zone d'étude éolienne","rayon_m":0,"enjeu":{"id":"ctx-eolien-zone","nom":"Zone d'étude éolienne — Enjeux de covisibilité et de distance","ico":"💨","niv":"moyen","tmin":2,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone identifiée comme favorable au développement éolien (Atlas C24)","Présence de massifs boisés offrant un potentiel de vent à 100 m de hauteur"],"consequences":["Etudes naturalistes et paysagères approfondies nécessaires","Distances minimales : 500 m des habitations, exclusion des zones Natura 2000"]},"economique":{"facteurs":["Coût d'un parc éolien : 1,5 à 2,5 M€/MW installé","Recettes IFER et TFPNB pour les communes d'accueil"],"consequences":["Retombées économiques locales significatives (100 000 à 500 000 €/an/commune)"]},"politique":{"facteurs":["ZAENR (Zones d'Accélération ENR) à délibérer par les communes avant fin 2025","Sraddet BFC : objectif 127 GWh/an PV dans le 90 — éolien à développer"],"consequences":["Commune non délibérante = projet plus difficile à instruire favorablement"]},"social":{"facteurs":["Acceptabilité sociale de l'éolien : enjeu majeur dans le 90 (paysage, patrimoine)"],"consequences":["Recours fréquents si concertation insuffisante en amont"]}},"actions":["Vérifier si la commune a délibéré sur les ZAENR","Engager une concertation précoce avec les élus et riverains","Commander une étude de vent (mât de mesure) sur 12 mois minimum"],"refs":[{"n":"C24","t":"Potentiel éolien"},{"n":"C21","t":"Etat lieux ENR"}]}},"moustique":{"label":"Zone surveillance moustique tigre","rayon_m":0,"enjeu":{"id":"ctx-moustique","nom":"Moustique tigre — Enjeu sanitaire et conception du projet","ico":"🦟","niv":"faible","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone de surveillance active du moustique tigre (Aedes albopictus) — Atlas C91","Présence confirmée en Nord Franche-Comté depuis 2023"],"consequences":["Vecteur de dengue, chikungunya, zika (5 cas dengue importés en 2024 en NFC)","Eaux stagnantes dans le projet = gîte larvaire potentiel"]},"economique":{"facteurs":["Coût de la démoustication professionnelle si prolifération"],"consequences":["Surcoût de gestion des espaces paysagers si eaux stagnantes non maîtrisées"]},"politique":{"facteurs":["Signalement obligatoire à l'ARS BFC en cas de foyer de dengue locale"],"consequences":["Responsabilité du gestionnaire si gîtes larvaires non traités sur l'emprise"]},"social":{"facteurs":["Nuisance pour les futurs usagers du projet (piqûres, risque sanitaire)"],"consequences":["Confort d'usage dégradé si moustique tigre non pris en compte dans la conception"]}},"actions":["Supprimer toute eau stagnante dans la conception du projet (soucoupes, gouttières, bassins mal drainés)","Utiliser des insecticides larvicides sur les gîtes résiduels incompressibles","Signaler tout gîte à l'ARS BFC ou sur le site signalement-moustique.anses.fr"],"refs":[{"n":"C91","t":"Moustique tigre — enjeu sanitaire"}]}}};

/* ── Point-in-polygon (algorithme ray casting) ── */
function pointInPolygon(lat, lng, polygonCoords) {
  /* polygonCoords = [[lng, lat], ...] (format GeoJSON) */
  var inside = false;
  var x = lng, y = lat;
  var n = polygonCoords.length;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var xi = polygonCoords[i][0], yi = polygonCoords[i][1];
    var xj = polygonCoords[j][0], yj = polygonCoords[j][1];
    var intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ── Distance entre deux points (km) ── */
function distLatLng(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Teste si le projet est dans/proche d'une feature ── */
function projetDansFeature(lat, lng, feature, rayonM) {
  var geom = feature.geometry;
  if (!geom) return false;

  if (geom.type === 'Polygon') {
    /* Extérieur du polygone */
    var ring = geom.coordinates[0];
    return pointInPolygon(lat, lng, ring);
  }

  if (geom.type === 'Point') {
    if (!rayonM || rayonM <= 0) return false;
    var dist = distLatLng(lat, lng, geom.coordinates[1], geom.coordinates[0]);
    return dist * 1000 <= rayonM;
  }

  if (geom.type === 'LineString') {
    if (!rayonM || rayonM <= 0) return false;
    /* Distance point-à-segment pour chaque segment */
    var coords = geom.coordinates;
    for (var k = 0; k < coords.length - 1; k++) {
      var d = distPointSegment(lat, lng,
        coords[k][1], coords[k][0],
        coords[k+1][1], coords[k+1][0]);
      if (d * 1000 <= rayonM) return true;
    }
    return false;
  }
  return false;
}

/* Distance point-à-segment (résultat en km) */
function distPointSegment(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay;
  var lenSq = dx*dx + dy*dy;
  var t = lenSq > 0 ? ((px-ax)*dx + (py-ay)*dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return distLatLng(px, py, ax + t*dx, ay + t*dy);
}

lancerAnalyse = function() {

  /* ── Vérifications préalables ── */
  if (!A.typeProjet) {
    alert("Selectionnez d'abord un type de projet.");
    return;
  }
  if (!A.position) {
    var msgP = document.getElementById('placement-requis');
    if (msgP) { msgP.classList.add('on'); msgP.scrollIntoView({ behavior:'smooth', block:'center' }); }
    var btnP = document.getElementById('btn-placer');
    if (btnP) { btnP.style.boxShadow = '0 0 0 4px rgba(234,88,12,.35)'; setTimeout(function(){ btnP.style.boxShadow=''; }, 2000); }
    return;
  }
  var msgR = document.getElementById('placement-requis');
  if (msgR) msgR.classList.remove('on');

  /* ══════════════════════════════════════════════════════════════
     ÉTAPE 1 — Détection géographique des zones sensibles
     Parcourt toutes les features de COUCHES_DATA et teste si le
     projet est dans/à proximité de chaque feature.
     Retourne un Set des type-IDs de zones actives.
     ex : { "ppri", "radon", "znieff2", "perimetre_MH" }
     ══════════════════════════════════════════════════════════════ */
  var zonesResultats = detecterZones(A.position.lat, A.position.lng, A.typeProjet);

  /* Set des types de zones géographiques détectées pour le projet */
  var zonesActives = new Set();
  zonesResultats.forEach(function(res) {
    res.zones.forEach(function(z) { zonesActives.add(z.type); });
  });

  /* ══════════════════════════════════════════════════════════════
     ÉTAPE 2 — Filtrage des enjeux de base
     Les enjeux sans "zones_requises" (null) sont toujours affichés.
     Les enjeux avec "zones_requises" ne sont affichés QUE si au
     moins une des zones requises est présente dans zonesActives.
     ══════════════════════════════════════════════════════════════ */
  var tous = ENJEUX[A.typeProjet] || [];
  var filtres = tous.filter(function(e) {
    /* Filtre envergure */
    if (e.tmin > A.taille) return false;
    /* Filtre zones : si zones_requises est null → toujours affiché */
    if (!e.zones_requises || e.zones_requises.length === 0) return true;
    /* Sinon : n'afficher que si le projet est dans une zone requise */
    return e.zones_requises.some(function(z) { return zonesActives.has(z); });
  });

  /* ══════════════════════════════════════════════════════════════
     ÉTAPE 3 — Enjeux contextuels (ENJEUX_ZONES)
     Ajoute les enjeux spécifiques aux zones détectées
     (PPRi, Natura 2000, MH, radon...) si pas déjà présents.
     ══════════════════════════════════════════════════════════════ */
  zonesResultats.forEach(function(res) {
    var ez = res.enjeu;
    if (ez.tmin > A.taille) return;
    var dejaPresent = filtres.some(function(e) { return e.id === ez.id; });
    if (!dejaPresent) filtres.push(ez);
  });

  /* ── Tri : enjeux contextuels en tête, puis par niveau ── */
  var ord = { eleve: 0, moyen: 1, faible: 2 };
  filtres.sort(function(a, b) {
    var aZ = a.contexte_zone ? 0 : 1;
    var bZ = b.contexte_zone ? 0 : 1;
    if (aZ !== bZ) return aZ - bZ;
    return (ord[a.niv] || 2) - (ord[b.niv] || 2);
  });

  /* ── Mise à jour en-tête ── */
  var t = TYPES.find(function(x) { return x.id === A.typeProjet; });
  document.querySelector('#enjeux-hdr h2').textContent = 'Enjeux \u2014 ' + (t ? t.label : '');

  var nZones = zonesResultats.length;
  var infos  = [filtres.length + ' enjeu(x)', TAILLES[A.taille].nom];
  if (A.superficieHa) infos.push(A.superficieHa.toFixed(2) + ' ha');
  if (nZones > 0)     infos.push(nZones + ' zone(s) d\u00e9tect\u00e9e(s)');
  document.getElementById('enjeux-sous-titre').textContent = infos.join(' \u00B7 ');

  /* ── Affichage ── */
  document.getElementById('msg-accueil').style.display = 'none';
  var liste = document.getElementById('liste-enjeux');
  liste.style.display = 'flex';
  liste.innerHTML = '';

  if (filtres.length === 0) {
    liste.innerHTML =
      '<div style="text-align:center;padding:32px 20px;color:var(--ink-3);">' +
        '<div style="font-size:2.2rem;margin-bottom:12px;">\u2705</div>' +
        '<p style="font-size:.82rem;line-height:1.6;">Aucun enjeu d\u00e9tect\u00e9 pour ce type de projet \u00e0 cet emplacement.</p>' +
      '</div>';
    afficherContacts();
    afficherChecklist();
    afficherAlentours();
    return;
  }

  /* Accordéon rouge des contraintes géographiques (si zones détectées) */
  if (zonesResultats.length > 0) {
    rendreAccordeonZones(zonesResultats, liste);
  }

  /* 4 accordéons thématiques */
  rendreAccordeons(filtres, liste);

  /* Sections post-analyse */
  afficherContacts();
  afficherChecklist();
  afficherAlentours();
};

/* ════════════════════════════════════════════════════════════════════
   DÉTECTION DE ZONES — moteur de géodétection
   Détermine quels enjeux conditionnels s'appliquent selon la position
   du projet par rapport aux features de COUCHES_DATA.
   ════════════════════════════════════════════════════════════════════ */

/* Base de données des enjeux conditionnels par zone
   Chargée depuis enjeux-zones.json puis embarquée ici */
/* ENJEUX_ZONES embarqués (compatibilité file:// et HTTP)
   Source canonique : enjeux-zones.json */
var ENJEUX_ZONES = [{"id":"zone-ppri-inondation","zone_types":["ppri","azi"],"zone_layers":["risques"],"zone_distance":0,"types_projets":["logement","zae","equipement","energie","transport","agriculture","nature","friche"],"nom":"Zone inondable — PPRi/AZI détecté","ico":"🌊","niv":"eleve","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé dans ou à proximité d'une zone inondable identifiée dans le PPRi (Plan de Prévention du Risque inondation) ou l'AZI (Atlas des Zones Inondables)","85 des 101 communes du Territoire de Belfort sont soumises au risque inondation","La Savoureuse, la Bourbeuse et l'Allaine sont les trois cours d'eau couverts par des PPRi opposables","Le nœud hydrographique vosgien réagit très rapidement lors des fontes de neige"],"consequences":["Interdiction absolue de construire en zone rouge PPRi (risque fort)","Prescriptions constructives obligatoires en zone bleue PPRi (plancher surélevé, matériaux résistants)","Etude hydraulique requise pour tout projet modifiant l'écoulement des eaux","Risque de dommages matériels majeurs si construction non conforme"]},"economique":{"facteurs":["Coût des études hydrauliques supplémentaires (5 000 à 20 000 €)","Surprime d'assurance habitation/multirisque en zone inondable","Dépréciation de la valeur vénale du bien situé en zone bleue ou rouge","Coût des mesures constructives (plancher surélevé, soupiraux, matériaux)"],"consequences":["Renchérissement de 8 à 25 % du coût de construction en zone bleue","Impossibilité d'obtenir un financement bancaire en zone rouge PPRi","Obligation d'information préventive de l'acquéreur (IAL — loi ALUR)","Indemnisation limitée en cas de sinistre si non-respect des prescriptions PPRi"]},"politique":{"facteurs":["PPRi Savoureuse, PPRi Bourbeuse, PPRi Allaine : 3 documents opposables dans le 90","Servitude d'utilité publique annexée au PLU : contrainte réglementaire directe","Instruction de la DDT 90 : consultation systématique du PPRi avant tout accord de principe","AZI Bourbeuse et AZI Douce : cartographies de référence pour les zones non couvertes par PPRi"],"consequences":["Refus du permis de construire garanti en zone rouge PPRi sans dérogation exceptionnelle","Délai d'instruction majoré de 1 à 3 mois pour l'analyse du risque inondation","Responsabilité pénale du maire en cas d'autorisation accordée à tort","Obligation de mentionner le risque dans tout acte de vente ou bail"]},"social":{"facteurs":["Sécurité des futurs occupants face aux crues soudaines et de plaine","Mémoire collective des inondations historiques dans le 90 (1999, 2007, 2021)","Vulnérabilité accrue des populations âgées et PMR en cas d'évacuation d'urgence","Importance du Plan Communal de Sauvegarde (PCS) dans les communes concernées"],"consequences":["Risque vital pour les occupants en cas de crue rapide (crues éclairs vosgiens)","Perturbation prolongée de l'activité économique après sinistre (relogement, réparations)","Traumatismes psychologiques liés aux inondations récurrentes","Coût social estimé à plusieurs millions d'euros par événement majeur"]}},"actions":["Consulter immédiatement la carte PPRi en mairie (gratuit, obligatoire avant tout dépôt de PC)","Vérifier la couleur de la zone : rouge = refus, bleue = prescriptions, blanche = pas de contrainte PPRi","Commander une étude hydraulique si le projet modifie l'écoulement des eaux","Contacter la DDT 90 (service risques) pour un avis préalable informel","Prévoir le plancher habitable à 50 cm minimum au-dessus de la cote de référence de crue"],"refs":[{"n":"C57","t":"Risque inondation"},{"n":"C58","t":"PPRi Savoureuse/Bourbeuse/Allaine"}]},{"id":"zone-sismique-3","zone_types":["sismique_3"],"zone_layers":["risques"],"zone_distance":0,"types_projets":["logement","equipement","zae"],"nom":"Zone de sismicité 3 — Vosges du Sud","ico":"🪨","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé en zone de sismicité modérée (niveau 3) dans le massif vosgien","Risque de secousses pouvant atteindre l'intensité VII sur l'échelle MSK","Interaction possible avec les aléas de mouvements de terrain en zone pentue","Historique sismique : séismes ressentis à Bâle (1356) encore perceptibles dans la zone"],"consequences":["Dommages structurels possibles sur les bâtiments non parasismiques","Amplification du risque en cas de sols meubles ou de versants instables","Risque de liquéfaction des sols saturés en eau lors d'un séisme","Cumul possible avec le risque de mouvement de terrain vosgien"]},"economique":{"facteurs":["Surcoût parasismique pour les structures (béton armé, bois, acier) : +5 à +15%","Etudes géotechniques de site recommandées pour les ERP et IGH","Assurance dommages-ouvrage majorée en zone sismique 3","Coût de mise en conformité des bâtiments existants non parasismiques"],"consequences":["Budget construction majoré de 5 à 15% pour respecter l'Eurocode 8","Délai de conception allongé pour l'ingénierie parasismique","Potentielle dépréciation des biens non mis aux normes parasismiques","Frais d'expertise post-séisme à prévoir dans le budget de gestion"]},"politique":{"facteurs":["Décret du 22 octobre 2010 : zonage sismique réglementaire en vigueur","Eurocode 8 (EN 1998) : norme de construction parasismique obligatoire en zone 3","Arrêté du 22 octobre 2010 : règles de construction parasismique applicables","ERP et IGH : règles renforcées indépendamment de la zone"],"consequences":["Non-conformité parasismique = mise en demeure et refus de certificat de conformité","Responsabilité du maître d'ouvrage engagée en cas de sinistre si normes non respectées","Déclaration obligatoire de la zone sismique dans les actes notariaux","Contrôle technique obligatoire pour les ERP de catégories 1 à 4 en zone 3"]},"social":{"facteurs":["Culture du risque sismique limitée dans le Territoire de Belfort (moins visible que l'inondation)","Population peu sensibilisée aux gestes de protection en cas de séisme","Bâtiments anciens (centre-ville de Belfort, villages vosgiens) potentiellement vulnérables","Plan ORSEC SEISME : réponse départementale organisée mais peu testée"],"consequences":["Risque de panique et d'évacuation désorganisée sans information préventive","Dommages plus importants sur le patrimoine bâti ancien non renforcé","Nécessité de sensibilisation du grand public aux comportements à adopter","Impact potentiellement fort sur les établissements recevant du public"]}},"actions":["Appliquer l'Eurocode 8 dans la conception structurelle (maître d'œuvre spécialisé)","Réaliser une étude géotechnique de site pour caractériser le sol (catégorie A à E)","Prévoir un contrôle technique sismique pour les ERP et les bâtiments > 28m","Consulter le BRGM pour la cartographie détaillée du risque sismique local"],"refs":[{"n":"C59","t":"Risque sismique"}]},{"id":"zone-mvt-terrain","zone_types":["mvt_terrain"],"zone_layers":["risques"],"zone_distance":0,"types_projets":["logement","zae","equipement","energie","transport","nature"],"nom":"Aléa mouvement de terrain — versants vosgiens","ico":"⛰","niv":"eleve","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé dans une zone d'aléa mouvements de terrain des versants vosgiens","Glissements, éboulements, coulées de boue recensés dans le massif vosgien","Terrain soumis à l'érosion et à l'instabilité lors des épisodes pluvieux intenses","Présence de versants à forte pente (> 10 %) et de formations géologiques instables"],"consequences":["Risque de glissement de terrain lors d'épisodes de pluies prolongées","Déstabilisation possible des fondations si terrain non diagnostiqué","Risque d'endommagement irréversible de l'infrastructure en cas d'événement","Aggravation potentielle par le changement climatique (épisodes pluvieux plus intenses)"]},"economique":{"facteurs":["Etude géotechnique G1 (reconnaissance préliminaire) obligatoire : 800 à 2 000 €","Etude G2 (avant-projet) nécessaire si risque identifié : 3 000 à 8 000 €","Coût des fondations renforcées (pieux, micropieux) si sols instables : +20 à +50%","Systèmes de drainage et de confortement des talus : 5 000 à 50 000 €"],"consequences":["Renchérissement significatif du coût de construction sur terrains pentus","Responsabilité décennale du constructeur engagée en cas de sinistre géotechnique","Indemnisation complexe par l'assurance si prévention insuffisante","Coût de reconstruction ou de consolidation après sinistre souvent supérieur au coût initial"]},"politique":{"facteurs":["Cartographie BRGM des mouvements de terrain : référence réglementaire nationale","PPR mouvements de terrain : peut être prescrit par le préfet en zone à risque","Loi ELAN 2018 : étude géotechnique G1+G2 obligatoire pour les maisons individuelles en zone exposée","Arrêté préfectoral de catastrophe naturelle applicable après un sinistre avéré"],"consequences":["Instruction du permis avec consultation de la carte des mouvements de terrain","Possible refus ou prescription d'étude approfondie si zone rouge identifiée","Responsabilité du maire engagée si autorisation accordée en zone à risque avérée","Obligation de mention dans les actes de vente (IAL — loi ALUR)"]},"social":{"facteurs":["Sécurité des personnes exposées au risque de glissement soudain","Présence possible d'habitations existantes sur des versants instables dans les villages vosgiens","Risque d'interruption des voies d'accès (routes, chemins) par coulée ou éboulement","Patrimoine naturel et paysager des versants vosgiens à préserver"],"consequences":["Risque vital pour les occupants d'un bâtiment en cas de glissement rapide","Coupure des accès et isolement des hameaux lors d'épisodes extrêmes","Perturbation du quotidien des habitants si travaux de confortement nécessaires","Anxiété et sentiment d'insécurité pour les riverains des zones instables"]}},"actions":["Consulter la carte BRGM des mouvements de terrain pour la parcelle exacte","Commander une étude géotechnique G1 dès la phase de faisabilité","Eviter les travaux de déblai/remblai qui déstabilisent les versants","Contacter la DDT 90 pour vérifier l'existence d'un PPR mouvements de terrain","Prévoir un système de drainage périphérique des eaux pluviales"],"refs":[{"n":"C60","t":"Mouvements de terrain"},{"n":"C61","t":"Retrait-gonflement argiles"}]},{"id":"zone-radon","zone_types":["radon"],"zone_layers":["risques"],"zone_distance":0,"types_projets":["logement","equipement","zae"],"nom":"Zone à potentiel radon élevé","ico":"☢","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé dans une zone géologique à fort potentiel radon (granite vosgien)","Le radon est un gaz radioactif naturel issu de la désintégration de l'uranium et du radium","Concentrations en radon plus élevées dans les zones de sous-sol granitique fracturé","Le radon s'accumule dans les espaces clos (sous-sols, espaces de vie au rez-de-chaussée)"],"consequences":["Exposition chronique au radon : 2e cause de cancer du poumon en France après le tabac","Concentration en radon variable selon la perméabilité du sol et la ventilation du bâtiment","Nécessité d'une ventilation mécanique contrôlée (VMC) pour limiter l'accumulation","Risque sanitaire à long terme si aucune mesure préventive n'est prise"]},"economique":{"facteurs":["Coût des mesures préventives en construction neuve : 500 à 2 000 € (membrane, VMC)","Coût d'un diagnostic radon en bâtiment existant : 150 à 300 € (3 mois de mesure)","Coût de remédiation si niveau > 300 Bq/m³ : 2 000 à 10 000 € selon les travaux","Obligation de travaux dans les ERP si concentration > 300 Bq/m³ (délai 3 ans)"],"consequences":["Investissement préventif rentable car curatif beaucoup plus coûteux","Dépense de santé publique évitée si prévention intégrée dès la conception","Possible dépréciation immobilière si diagnostics radon défavorables rendus publics","Coût de suivi annuel recommandé en zone à potentiel radon élevé"]},"politique":{"facteurs":["Arrêté du 27 juin 2018 : niveau de référence à 300 Bq/m³ dans les bâtiments","ERP catégories 1 à 4 : mesures obligatoires si niveau > 300 Bq/m³","Loi de modernisation du système de santé 2016 : intégration du radon dans les diagnostics","Plan National Radon 2020–2024 : réduction de l'exposition de la population"],"consequences":["Obligation de diagnostic radon dans les ERP en zone à potentiel élevé","Travaux de remédiation obligatoires dans les ERP si dépassement du seuil","Mention du risque radon dans les diagnostics immobiliers des zones concernées","Responsabilité du maître d'ouvrage en cas de sinistre sanitaire post-construction"]},"social":{"facteurs":["Faible connaissance du risque radon dans la population générale","Présence plus forte dans les bâtiments anciens peu ventilés (maisons en pierre)","Cumul possible avec le tabagisme : risque multiplié par 5 pour les fumeurs exposés au radon","Besoin d'information et de sensibilisation des élus, des particuliers et des professionnels"],"consequences":["Augmentation du risque de cancer du poumon pour les occupants non informés","Sentiment d'injustice des habitants si le risque est découvert tardivement","Nécessité de campagnes de sensibilisation et de dépistage dans les zones concernées","Impact psychologique des diagnostics positifs sur les propriétaires"]}},"actions":["Intégrer une membrane anti-radon sous la dalle dès la conception (coût minimal en neuf)","Prévoir une VMC double flux dans tout bâtiment résidentiel ou ERP en zone radon","Commander un diagnostic radon en rénovation avant travaux (3 mois de mesure minimum)","Consulter la cartographie radon IRSN pour la commune exacte du projet"],"refs":[{"n":"C64","t":"Risque Radon"}]},{"id":"zone-humide","zone_types":["zone_humide"],"zone_layers":["eau"],"zone_distance":50,"types_projets":["logement","zae","equipement","energie","transport","agriculture","nature","friche"],"nom":"Zone humide probable détectée","ico":"🦆","niv":"eleve","tmin":1,"axes":{"environnement":{"facteurs":["Une zone humide probable est identifiée à moins de 50m du projet (cartographie DDT 90, Atlas C46)","Les zones humides remplissent des fonctions écosystémiques essentielles : régulation des crues, épuration de l'eau, biodiversité","Le Territoire de Belfort présente de nombreuses zones humides dans les fonds de vallée de la Savoureuse et de la Bourbeuse","50% des zones humides françaises ont disparu depuis 1960 — patrimoine naturel irremplaçable"],"consequences":["Toute destruction de zone humide est soumise à autorisation et compensation obligatoire (200% minimum)","Impact irréversible sur la biodiversité aquatique et semi-aquatique","Réduction de la capacité d'autoépuration naturelle des cours d'eau en aval","Aggravation des crues si zone humide détruite (perte du rôle tampon)"]},"economique":{"facteurs":["Délimitation précise de la zone humide par sondages pédologiques : 3 000 à 8 000 €","Coût des mesures compensatoires si destruction inévitable : 5 000 à 50 000 €/ha","Dossier loi sur l'eau IOTA : coût de constitution (bureau d'études) 5 000 à 30 000 €","Coût de reconception du projet pour éviter la zone humide (variante de tracé ou d'implantation)"],"consequences":["Surcoût significatif si zone humide impactée et mesures compensatoires requises","Allongement des délais de 6 à 12 mois pour l'instruction du dossier loi sur l'eau","Financement possible par l'Agence de l'eau RMC pour les projets de restauration","Blocage du projet par contentieux NGO si zone humide détruite sans autorisation"]},"politique":{"facteurs":["Article L.214-1 du Code de l'environnement : régime IOTA (déclaration >0,1 ha, autorisation >1 ha)","SAGE Allan : le schéma d'aménagement et de gestion des eaux fixe des objectifs de préservation","Arrêté du 24 juin 2008 : définition et critères de délimitation des zones humides","DCE (Directive Cadre sur l'Eau) : objectif bon état écologique des masses d'eau d'ici 2027"],"consequences":["Instruction par la DDT 90 (police de l'eau) avec consultation de l'Agence de l'eau","Enquête publique obligatoire pour les dossiers IOTA en régime d'autorisation","Arrêté de mise en demeure si travaux engagés sans dossier loi sur l'eau","Sanction pénale possible (jusqu'à 2 ans d'emprisonnement et 150 000 € d'amende)"]},"social":{"facteurs":["Services rendus par la zone humide aux habitants : régulation des crues, eau potable, biodiversité","Activités récréatives (pêche, randonnée, observation naturaliste) liées aux zones humides","Patrimoine paysager et identité territoriale des fonds de vallée vosgiens et sundgauviens","Sensibilité des associations environnementales locales à la préservation des zones humides"],"consequences":["Opposition locale forte si zone humide impactée sans concertation","Perte de services écosystémiques gratuits pour les habitants (valeur estimée à plusieurs k€/ha/an)","Recours associations possibles jusqu'au tribunal administratif","Impact sur la qualité de l'eau potable si zone humide détruite en amont d'un captage"]}},"actions":["Faire délimiter la zone humide par un bureau d'études agréé avant tout dépôt de permis","Appliquer la séquence Eviter-Réduire-Compenser (ERC) : prioriser l'évitement","Déposer un dossier loi sur l'eau IOTA à la DDT 90 si impact inévitable > 0,1 ha","Contacter l'Agence de l'eau RMC pour un financement si le projet vise la restauration","Consulter l'Atlas des zones humides probables DDT 90 (C46) avant toute décision"],"refs":[{"n":"C46","t":"Zones humides probables"},{"n":"C43","t":"SAGE Allan"}]},{"id":"zone-cours-eau","zone_types":["cours_eau","corridor_bleu"],"zone_layers":["eau","biodiversite"],"zone_distance":100,"types_projets":["logement","zae","equipement","energie","transport","agriculture","friche"],"nom":"Cours d'eau à moins de 100m — Continuité écologique","ico":"🏞","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Un cours d'eau est identifié à moins de 100m du projet (Savoureuse, Bourbeuse, Allaine, Lizaine ou affluent)","Continuité écologique longitudinale, transversale et verticale potentiellement impactée","Zone de ripisylve (bande boisée des berges) pouvant constituer un corridor TVB","Seulement 15% des masses d'eau en bon état écologique dans le Territoire de Belfort"],"consequences":["Obligation de bande tampon de 5m minimum non imperméabilisée le long du cours d'eau","Interdiction des rejets directs d'eaux pluviales non traitées dans le cours d'eau","Impact potentiel sur les frayères et les habitats aquatiques riverains","Risque de ruissellement de polluants (hydrocarbures, pesticides, métaux lourds) vers le cours d'eau"]},"economique":{"facteurs":["Dossier loi sur l'eau si travaux à moins de 10m d'un cours d'eau (rubrique 3.1.5.0)","Coût des bassins de rétention et de traitement des eaux de ruissellement","Servitude de 3m de berge non constructible le long de certains cours d'eau","Coût des mesures de protection pendant les travaux (batardeau, filtres à sédiments)"],"consequences":["Emprise constructible réduite par les servitudes de berge","Majoration du coût de gestion des eaux pluviales (traitement avant rejet)","Délai d'instruction majoré si dossier loi sur l'eau requis","Risque de contentieux si pollution du cours d'eau pendant les travaux"]},"politique":{"facteurs":["Code de l'environnement art. L.215-14 : bande de 3m non constructible sur les berges","Rubrique 3.1.5.0 IOTA : déclaration si travaux à moins de 10m d'un cours d'eau","Plan de gestion de la Savoureuse, de la Bourbeuse et de l'Allaine","DCE : interdiction de dégradation de l'état des masses d'eau"],"consequences":["Servitude de 3m de berge opposable au permis de construire","Police de l'eau (DDT 90) compétente pour contrôler les travaux riverains","Arrêté de mise en demeure et astreinte si servitude non respectée","Possibilité de prescriptions spéciales dans le permis (protection des berges)"]},"social":{"facteurs":["Accès au cours d'eau pour les habitants (sentiers de randonnée, pêche)","Valeur paysagère et récréative des berges pour les communes riveraines","Identité des centres-bourgs historiquement liés aux cours d'eau vosgiens","Risque de pollution visible et médiatique en cas d'incident pendant les travaux"],"consequences":["Opposition des pêcheurs et des associations de protection des cours d'eau","Valorisation du projet si les berges sont préservées voire restaurées","Contribution à l'aménagement durable si la ripisylve est maintenue","Impact sur le tourisme vert lié aux cours d'eau si qualité dégradée"]}},"actions":["Maintenir une bande tampon de 5m minimum non imperméabilisée le long des berges","Installer des dispositifs anti-érosion et de filtration des eaux de chantier","Vérifier si un dossier loi sur l'eau IOTA est requis (rubrique 3.1.5.0)","Contacter le syndicat de rivière compétent pour les travaux sur berges","Préserver ou restaurer la ripisylve (bande boisée des berges)"],"refs":[{"n":"C41","t":"Cartographie cours d'eau"},{"n":"C42","t":"Continuité écologique"}]},{"id":"zone-natura2000","zone_types":["natura2000","reserve","reservoir"],"zone_layers":["biodiversite"],"zone_distance":0,"types_projets":["logement","zae","equipement","energie","transport","agriculture","nature","friche"],"nom":"Zone Natura 2000 / Réservoir de biodiversité TVB","ico":"🦋","niv":"eleve","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé dans ou à proximité d'un site Natura 2000 ou d'un réservoir de biodiversité TVB","Ces espaces abritent des habitats naturels et des espèces d'intérêt européen à fort enjeu de conservation","La ZNIEFF et les réservoirs TVB constituent le réseau écologique de référence du massif vosgien","Natura 2000 couvre plusieurs milliers d'hectares dans la partie nord du Territoire de Belfort"],"consequences":["Evaluation d'incidences Natura 2000 obligatoire si impact possible sur le site","Séquence ERC impérative avec mesures de compensation si impact résiduel significatif","Dérogation CNPN (Conseil National de Protection de la Nature) si espèces protégées impactées","Risque de fragmentation de la TVB et d'isolement des populations animales"]},"economique":{"facteurs":["Coût de l'évaluation d'incidences Natura 2000 : 5 000 à 30 000 €","Coût des inventaires biologiques spécifiques (chiroptères, rapaces, flore) : 15 000 à 60 000 €","Coût des mesures compensatoires ERC si impact résiduel : 10 000 à 200 000 €","Risque financier majeur si projet annulé en contentieux après investissement initial"],"consequences":["Budget études environnementales pouvant représenter 5 à 15% du coût total","Allongement des délais de 12 à 36 mois pour les projets en zone Natura 2000","Risque d'abandon du projet si compensation impossible ou trop coûteuse","Valorisation économique de la biodiversité préservée (tourisme, services écosystémiques)"]},"politique":{"facteurs":["Directive Habitats (92/43/CEE) et Directive Oiseaux (79/409/CEE) : fondements juridiques","Article L.414-4 du Code de l'environnement : obligation d'évaluation d'incidences","SRCE BFC : prescriptions de maintien de la TVB dans les documents d'urbanisme","DREAL BFC : autorité compétente pour valider l'évaluation d'incidences"],"consequences":["Avis défavorable de la DREAL et de la Commission Européenne si impacts non évalués","Procédure d'infraction européenne possible si habitat prioritaire détruit","Recours en annulation du permis si évaluation d'incidences insuffisante","Arrêté de protection de biotope possible en complément de Natura 2000"]},"social":{"facteurs":["Valeur patrimoniale du massif vosgien et de sa biodiversité pour les habitants","Tourisme naturel et randonnée : activités économiques dépendant de la biodiversité","Sensibilité forte des associations naturalistes et environnementales locales","Opération Grand Site Ballon d'Alsace : démarche de valorisation en cours"],"consequences":["Opposition forte des associations si impact non compensé ou insuffisamment atténué","Médiatisation possible du conflit entre projet et protection de la nature","Contribution positive à l'attractivité si projet respecte et valorise la biodiversité","Label 'Grand Site de France' valorisable si projet exemplaire"]}},"actions":["Réaliser une évaluation préliminaire d'incidences Natura 2000 en phase de faisabilité","Commander des inventaires naturalistes spécifiques sur une année complète minimum","Contacter la DREAL BFC pour un cadrage préalable de l'étude d'impact","Appliquer la séquence ERC dès la conception du projet (choix de variante d'implantation)","Consulter le DOCOB (Document d'Objectifs) du site Natura 2000 concerné"],"refs":[{"n":"C52","t":"Protection patrimoine naturel"},{"n":"C53","t":"Trame verte"},{"n":"C54","t":"Trame bleue"}]},{"id":"zone-znieff","zone_types":["znieff1","znieff2"],"zone_layers":["biodiversite"],"zone_distance":0,"types_projets":["logement","zae","equipement","energie","transport","agriculture","nature"],"nom":"ZNIEFF détectée — Zone Naturelle d'Intérêt Ecologique","ico":"🌿","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Une ZNIEFF (Zone Naturelle d'Intérêt Ecologique Faunistique et Floristique) est identifiée sur ou à proximité du site","ZNIEFF de type I : zone de très grand intérêt biologique, habitat ou espèce remarquable","ZNIEFF de type II : grand ensemble naturel riche et peu modifié, offrant des potentialités biologiques importantes","Les ZNIEFF du massif vosgien incluent des tourbières, des forêts de hêtres-sapins et des pelouses d'altitude"],"consequences":["Inventaires naturalistes renforcés requis (flore, faune, habitats) sur au moins une saison","Espèces protégées potentiellement présentes : obligation de dérogation si impact","Intégration obligatoire dans l'étude d'impact si projet soumis à évaluation environnementale","Risque de découverte d'espèces protégées lors des travaux si inventaires insuffisants"]},"economique":{"facteurs":["Coût des inventaires naturalistes ZNIEFF : 5 000 à 25 000 € selon la taille et la saison","Coût d'une dérogation espèces protégées (CNPN) : 10 000 à 50 000 € de mesures compensatoires","Risque de découverte d'espèces protégées en cours de travaux (arrêt de chantier)","Valorisation possible : labellisation 'biodiversité' si projet exemplaire"],"consequences":["Budget environnemental à anticiper dès la phase de faisabilité","Arrêt de chantier coûteux si espèce protégée découverte non inventoriée","Subventions possibles pour les projets de préservation dans les ZNIEFF","Valorisation du projet et communication positive si biodiversité préservée"]},"politique":{"facteurs":["Les ZNIEFF sont des inventaires scientifiques sans portée réglementaire directe mais opposables en contentieux","Doctrine ERC nationale : évitement prioritaire dans les zones à forts enjeux écologiques","Préfet de région peut prescrire des études complémentaires si ZNIEFF impactée","DDT 90 : consultation systématique de la DREAL pour les projets en ZNIEFF"],"consequences":["Recours contentieux régulièrement couronnés de succès si ZNIEFF insuffisamment prise en compte","Avis réservé ou défavorable de la MRAe si étude d'impact ignore la ZNIEFF","Possibilité de prescription de mesures de suivi écologique post-travaux","Consultation publique : associations naturalistes attentives aux projets en ZNIEFF"]},"social":{"facteurs":["Valeur pédagogique et éducative des ZNIEFF pour les scolaires et le grand public","Attractivité touristique des zones naturelles remarquables inventoriées","Fierté locale pour les communes abritant des ZNIEFF (richesse patrimoniale)","Sensibilité croissante du grand public aux enjeux de biodiversité"],"consequences":["Opposition des naturalistes et des associations si ZNIEFF dégradée","Opportunité de sensibilisation si projet intègre une démarche pédagogique","Image négative du porteur de projet si destruction médiatisée","Bénéfice réputationnel si project prend en compte et valorise la ZNIEFF"]}},"actions":["Télécharger et analyser les données ZNIEFF sur l'INPN (inpn.mnhn.fr) pour la zone du projet","Réaliser des inventaires botaniques et faunistiques sur au moins une saison complète","Prévoir des variantes d'implantation qui évitent les habitats les plus sensibles","Contacter la DREAL BFC pour connaître les espèces patrimoniales spécifiques de la ZNIEFF"],"refs":[{"n":"C53","t":"ZNIEFF et inventaire naturel"},{"n":"C52","t":"Protection patrimoine naturel"}]},{"id":"zone-nitrates","zone_types":["nitrates"],"zone_layers":["agriculture"],"zone_distance":0,"types_projets":["agriculture","zae","logement"],"nom":"Zone vulnérable aux nitrates","ico":"🧪","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé dans une zone vulnérable aux nitrates (bassin versant de l'Allan ou de la Bourbeuse)","Risque de pollution des eaux souterraines et superficielles par les nitrates d'origine agricole","Application du Programme d'Actions Nitrates (5e programme, arrêté préfectoral)","Enjeu de qualité de l'eau potable pour les captages AEP en aval"],"consequences":["Restrictions strictes sur les dates et doses d'épandage des engrais azotés","Obligation de couverture des sols en inter-culture pour limiter les fuites de nitrates","Risque de dépassement de la norme eau potable (50 mg/L) si pratiques non conformes","Eutrophisation des cours d'eau et des plans d'eau en cas de pollution diffuse"]},"economique":{"facteurs":["Coût des analyses de sol et de l'eau pour le suivi de la fertilisation","Investissement dans le stockage des effluents (minimum 6 mois en zone vulnérable)","Aides MAEC disponibles pour compenser les contraintes économiques (100 à 300 €/ha)","Pénalités PAC si non-respect de la conditionnalité renforcée (BCAE 1, 4, 5, 9)"],"consequences":["Coût de mise en conformité des stockages d'effluents parfois élevé (10 000 à 50 000 €)","Réduction possible de la marge si rendements limités par les restrictions d'azote","Valorisation économique possible via les certifications HVE ou AB en zone vulnérable","Sanctions PAC pouvant atteindre 5 à 10% de la totalité des aides reçues"]},"politique":{"facteurs":["Directive Nitrates européenne (91/676/CEE) : transposée dans le 5e Programme d'Actions","Arrêté préfectoral du Territoire de Belfort : fixe les prescriptions locales","DDT 90 : contrôle du respect du programme d'actions lors des visites exploitations","Conditionnalité PAC renforcée : BCAE 1 (zones tampons), BCAE 9 (pas d'épandage sur terres inondées)"],"consequences":["Contrôles inopinés de la DDT 90 avec sanctions financières PAC possibles","Mise en demeure préfectorale si pollution avérée du captage AEP","Responsabilité civile de l'exploitant si dommages causés aux tiers","Interdiction temporaire d'épandage sur certaines parcelles sensibles"]},"social":{"facteurs":["Qualité de l'eau potable : enjeu de santé publique pour les habitants","Image de l'agriculture locale auprès des consommateurs (circuits courts, qualité)","Initiative 'L'Eau d'Ici' (CCST) : coopération agriculteurs-collectivités exemplaire","Dialogue entre agriculteurs et gestionnaires de l'eau indispensable"],"consequences":["Confiance des consommateurs maintenue si qualité de l'eau préservée","Tensions possibles entre agriculteurs et collectivités gestionnaires de l'eau","Valorisation de l'image agricole si démarche volontaire de réduction des nitrates","Coût de la dépollution de l'eau potable répercuté sur la facture des ménages"]}},"actions":["Consulter le Programme d'Actions Nitrates applicable (arrêté préfectoral en vigueur)","Réaliser un plan de fumure prévisionnel avec la Chambre d'Agriculture du 90","Vérifier la capacité de stockage des effluents (minimum 6 mois réglementaire)","Contacter la CCST pour l'initiative 'L'Eau d'Ici' et les aides MAEC disponibles"],"refs":[{"n":"C40","t":"Zones vulnérables nitrates"},{"n":"C48","t":"Prélèvements eau"}]},{"id":"zone-monument-historique","zone_types":["perimetre_MH","MH_classe","MH_inscrit"],"zone_layers":["patrimoine"],"zone_distance":500,"types_projets":["logement","zae","equipement","energie","transport","friche"],"nom":"Périmètre de protection Monument Historique (500m)","ico":"🏛","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est situé dans le périmètre de 500m d'un Monument Historique (Citadelle Vauban, Lion de Belfort ou autre MH du 90)","Le périmètre de protection des abords concerne tout ce qui est visible depuis le monument ou en covisibilité","5 monuments classés ou inscrits dans le Territoire de Belfort dont la Citadelle Vauban (classée UNESCO)","Intégration paysagère et architecturale renforcée dans les secteurs protégés"],"consequences":["Obligation d'intégration architecturale et paysagère selon les prescriptions de l'ABF","Restriction des matériaux, couleurs, hauteurs et volumes constructibles","Impact visuel du projet sur le monument et ses abords strictement contrôlé","Impossibilité de certains aménagements (antennes, enseignes, menuiseries discordantes)"]},"economique":{"facteurs":["Coût d'un architecte du patrimoine ou DPLG qualifié maîtrise d'œuvre : +15 à +30%","Matériaux traditionnels imposés par l'ABF : surcoût de 10 à 25%","Délai d'instruction majoré de 1 à 2 mois pour l'avis ABF conforme","Potentielle valorisation patrimoniale du bien si bien intégré"],"consequences":["Surcoût global de 15 à 40% selon les prescriptions architecturales imposées","Valeur patrimoniale du bien augmentée si belle intégration dans le site protégé","Risque financier si l'ABF s'oppose au projet après engagement des études","Coût de reprise architecturale si premier projet refusé par l'ABF"]},"politique":{"facteurs":["Code du Patrimoine art. L.621-30 : avis conforme de l'ABF obligatoire dans les abords","UDAP 90 (Architecte des Bâtiments de France) : interlocuteur incontournable","Périmètre délimité des abords (PDA) possible en substitution du rayon de 500m","Site patrimonial remarquable (SPR) : protection renforcée dans certains secteurs"],"consequences":["Avis conforme ABF : opposition = refus du permis garanti sans recours possible hors juridictionnel","Délai d'instruction de 3 mois pour les permis en périmètre protégé (au lieu de 2)","Recours hiérarchique possible auprès du Préfet de Région si avis défavorable injustifié","Obligation de consultations préalables avec l'UDAP 90 avant dépôt du dossier"]},"social":{"facteurs":["Attachement fort des habitants au patrimoine historique de Belfort (Citadelle, Lion)","Tourisme patrimonial : 500 000 visiteurs/an à la Citadelle de Belfort","Identité territoriale et fierté locale fortement ancrées dans le patrimoine militaire","Sensibilité des associations de défense du patrimoine aux projets dans les abords"],"consequences":["Opposition locale si projet perçu comme attentatoire au patrimoine","Image du porteur de projet améliorée si intégration exemplaire","Contribution à l'attractivité touristique du territoire si projet valorisant","Pression médiatique et associative forte en cas de projet controversé"]}},"actions":["Prendre contact avec l'UDAP 90 (ABF) AVANT de déposer le permis pour un avis informel","Faire appel à un architecte du patrimoine (DPLG ou DESA) pour la conception","Préparer un dossier d'insertion paysagère et architecturale détaillé","Prévoir un délai d'instruction de 3 mois minimum pour les dossiers en périmètre MH"],"refs":[{"n":"C88","t":"Monuments historiques"},{"n":"C90","t":"Archéologie préventive"}]},{"id":"zone-AU","zone_types":["zone_AU","zone_AUx"],"zone_layers":["urbanisme"],"zone_distance":0,"types_projets":["logement","zae","equipement"],"nom":"Zone AU — Urbanisation future conditionnelle","ico":"📋","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé en zone AU (à urbaniser) du PLU, terrain non encore aménagé","Consommation d'espace naturel ou agricole à vérifier au regard de la loi ZAN","Réseaux d'infrastructure (eau, assainissement, voirie) non encore réalisés","Etude d'incidence environnementale requise selon la superficie de la zone"],"consequences":["Artificialisation des sols comptabilisée dans le bilan ZAN de la commune","Obligation de desserte par les réseaux avant toute construction","Possible étude d'impact si zone AU > 5 ha avec enjeux environnementaux","Création d'imperméabilisation à compenser par une gestion EP à la source"]},"economique":{"facteurs":["Coût de viabilisation de la zone AU (voirie, réseaux) : 100 à 300 €/m² de terrain","Participation aux équipements publics (PUP, ZAC) à négocier avec la commune","Taxe d'aménagement applicable sur toute la surface de plancher créée","Financement de l'OAP (Orientation d'Aménagement et de Programmation) requis"],"consequences":["Coût global de la viabilisation à intégrer dans le bilan de l'opération","Participation aux équipements publics pouvant représenter 5 à 15% du coût total","Nécessité d'une étude de faisabilité économique avant lancement","Valeur foncière à terme attractive si zone bien localisée et desservie"]},"politique":{"facteurs":["Ouverture de la zone AU conditionnée à la délibération du conseil municipal","Zone 2AU : ouverture à l'urbanisation nécessite une révision ou modification du PLU","Compatibilité avec le SCoT du Territoire de Belfort et son document d'orientation","Respect de l'OAP (Orientation d'Aménagement et de Programmation) du PLU"],"consequences":["Blocage possible si la commune refuse d'ouvrir la zone AU à l'urbanisation","Délai de 6 à 18 mois si révision du PLU nécessaire pour ouvrir une zone 2AU","Instruction du PC vérificant la compatibilité avec l'OAP applicable","Risque de remise en cause lors de la révision du PLU en cours (SCoT, ZAN)"]},"social":{"facteurs":["Débat local sur l'opportunité d'ouvrir de nouvelles zones à l'urbanisation","Besoins en équipements publics générés par la nouvelle population (école, crèche)","Acceptabilité sociale variable selon la nature et la densité du projet","Concertation possible avec les riverains lors de la création d'une ZAC"],"consequences":["Opposition des riverains si projet non concerté ou mal intégré","Demande de services et d'équipements par les nouveaux habitants","Valorisation de l'image communale si projet exemplaire et bien conçu","Pression sur les services publics locaux (école, déchets, transport)"]}},"actions":["Vérifier si la zone est 1AU (ouverture directe) ou 2AU (révision PLU nécessaire)","Consulter l'OAP du PLU applicable à la zone pour les prescriptions d'aménagement","Contacter la commune pour connaître les conditions d'ouverture et les participations requises","Vérifier la compatibilité du projet avec les orientations du SCoT du Territoire de Belfort"],"refs":[{"n":"C65","t":"Documents urbanisme opposables"},{"n":"C66","t":"Procédures en cours"},{"n":"C69","t":"Sobriété foncière"}]},{"id":"zone-foret","zone_types":["foret","reservoir"],"zone_layers":["biodiversite"],"zone_distance":50,"types_projets":["logement","zae","energie","transport","agriculture","nature"],"nom":"Zone forestière — Défrichement réglementé","ico":"🌲","niv":"moyen","tmin":1,"axes":{"environnement":{"facteurs":["Le projet est localisé dans ou à proximité d'une zone forestière (43% du territoire du 90 est boisé)","La forêt joue un rôle essentiel : biodiversité, stockage carbone, régulation du cycle de l'eau","Risque d'incendie de forêt croissant avec le changement climatique (épisodes de sécheresse)","Les forêts vosgiennes constituent le principal réservoir de biodiversité TVB du département"],"consequences":["Défrichement soumis à autorisation préfectorale systématique (code forestier)","Compensation du défrichement : reboisement 2x la surface défrichée ou paiement d'une indemnité","Risque de déstabilisation des versants si couvert forestier retiré (érosion, glissements)","Perte du stockage carbone forestier (contribution aux émissions GES)"]},"economique":{"facteurs":["Coût de l'autorisation de défrichement et des études préalables : 2 000 à 10 000 €","Coût de la compensation par reboisement : 3 000 à 8 000 €/ha replanté","Valeur du bois exploitable sur la parcelle à intégrer dans le bilan économique","Subventions possibles pour les projets de boisement compensatoire (France Relance)"],"consequences":["Surcoût de 5 à 15% si défrichement important requis","Délai de 6 à 18 mois pour l'obtention de l'autorisation de défrichement","Valeur foncière du terrain forestier différente du terrain constructible","Possibilité de valorisation sylvicole préalable au défrichement"]},"politique":{"facteurs":["Code forestier art. L.341-1 : autorisation de défrichement obligatoire","ONF (Office National des Forêts) : avis sur les projets en forêt publique","CNPF (Centre National de la Propriété Forestière) : conseil pour les forêts privées","Politique nationale forêt 2015 : gestion durable et multifonctionnelle"],"consequences":["Refus d'autorisation de défrichement si terrain en zone à risques ou protégée","Instruction par la DDT 90 (service forêt) avec consultation de l'ONF si forêt publique","Obligation de Plan Simple de Gestion (PSG) pour les forêts > 25 ha","Amendes et obligation de reboisement si défrichement illicite"]},"social":{"facteurs":["Attachement des habitants aux massifs forestiers vosgiens (randonnée, cueillette, chasse)","Rôle de la forêt dans la régulation climatique locale (îlots de fraîcheur en été)","Filière bois-énergie locale et emplois sylvicoles dans le massif vosgien","Sensibilité du grand public à la déforestation (contexte mondial)"],"consequences":["Opposition locale si défrichement visible et non compensé localement","Contribution à la perception négative du projet par les habitants","Impact sur les activités récréatives forestières (sentiers de randonnée, VTT)","Risque d'image négative dans un contexte de sensibilisation à la déforestation"]}},"actions":["Vérifier la nature publique ou privée de la forêt (cadastre, extrait de propriété)","Déposer une demande d'autorisation de défrichement auprès de la DDT 90 (service forêt)","Contacter l'ONF (forêts publiques) ou le CRPF (forêts privées) pour un conseil préalable","Prévoir la compensation par reboisement dès la conception du projet"],"refs":[{"n":"C57","t":"Couverture forestière"},{"n":"C63","t":"Aléas feux de forêts"}]},{"id":"zone-zppa-archeo","zone_types":["zppa","site_archeo"],"zone_layers":["patrimoine"],"zone_distance":0,"types_projets":["logement","zae","equipement","transport","friche"],"nom":"Zone archéologique — Diagnostic préventif obligatoire","ico":"🏺","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est localisé dans une Zone de Présomption de Prescription Archéologique (ZPPA) ou à proximité d'un vestige archéologique connu","Vestiges gallo-romains, médiévaux et industriels recensés dans le Territoire de Belfort","Voie romaine Mandeure–Mandeure traversant la plaine de Belfort (inscrite à l'inventaire)"],"consequences":["Diagnostic archéologique préventif prescrit par le Préfet de région avant tout terrassement","Découverte fortuite possible : arrêt immédiat du chantier obligatoire","Fouille archéologique si vestiges significatifs : délai et coût imprévisibles"]},"economique":{"facteurs":["Coût du diagnostic archéologique préventif : 5 000 à 30 000 € (partiellement à la charge de l'aménageur)","Fouille : de 50 000 € à plusieurs centaines de milliers d'euros si site majeur","Délai supplémentaire de 3 à 18 mois selon l'ampleur des découvertes"],"consequences":["Budget et planning à prévoir avec une marge de 5 à 10 % pour l'archéologie préventive","Risque de blocage du chantier si vestiges majeurs découverts sans prévision","Valorisation possible des découvertes (musée, circuit touristique)"]},"politique":{"facteurs":["Loi 2001-44 sur l'archéologie préventive : diagnostic obligatoire en ZPPA","Instruction par la DRAC BFC (Direction Régionale des Affaires Culturelles)","Prescription émise par arrêté du Préfet de région en amont du permis"],"consequences":["PC assorti d'une prescription archéologique préalable aux travaux de terrassement","Arrêt de chantier obligatoire en cas de découverte fortuite (Code du patrimoine)","Responsabilité pénale si découverte ignorée et travaux poursuivis"]},"social":{"facteurs":["Patrimoine archéologique local : identité culturelle et mémoire collective","Intérêt du grand public pour les découvertes archéologiques locales","Retards de chantier vécus négativement par les riverains et les futurs occupants"],"consequences":["Valorisation du territoire si découverte significative (exposition, médiation culturelle)","Frustration des porteurs de projet et des riverains en cas de blocage prolongé","Enrichissement du patrimoine historique local si site fouillé et documenté"]}},"actions":["Interroger la DRAC BFC dès le dépôt du PC pour savoir si une prescription est envisagée","Prévoir un délai de 3 à 6 mois pour le diagnostic dans le planning général","Budgéter une provision de 3 à 5 % du coût de construction pour l'archéologie préventive","Contacter le service régional de l'archéologie (SRA BFC) pour les projets > 5 000 m²"],"refs":[{"n":"C90","t":"Archéologie préventive"}]},{"id":"zone-grand-site","zone_types":["grand_site"],"zone_layers":["patrimoine","biodiversite"],"zone_distance":0,"types_projets":["logement","energie","transport","zae","equipement","nature"],"nom":"Opération Grand Site — Ballon d'Alsace","ico":"🏔","niv":"eleve","tmin":2,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est dans le périmètre de l'Opération Grand Site du Ballon d'Alsace (OGS C89)","Site naturel exceptionnel à forte fréquentation touristique (>400 000 visiteurs/an)","Milieux naturels d'altitude sensibles : tourbières, pelouses d'altitude, hêtraies-sapinières"],"consequences":["Toute intervention dans le périmètre OGS est soumise à un examen renforcé","Obligation de compatibilité avec le plan de gestion du Grand Site","Risque de dégradation des milieux naturels et du paysage si intégration insuffisante"]},"economique":{"facteurs":["Exigences architecturales et paysagères élevées : surcoût de 10 à 25 %","Label 'Grand Site de France' valorisable économiquement si projet exemplaire","Attractivité touristique du site : retombées économiques locales significatives"],"consequences":["Coût de conception et d'étude paysagère majoré","Valeur du projet renforcée si labellisation Grand Site obtenue","Risque de contentieux si projet perçu comme dégradant le site"]},"politique":{"facteurs":["Réseau des Grands Sites de France : charte et engagements de gestion durable","Conseil Départemental du 90 : maître d'ouvrage de l'OGS","Avis obligatoire de la DREAL BFC et du Conseil Départemental pour les projets dans l'OGS"],"consequences":["Instruction renforcée : consultation de la DREAL, du CD90 et du SDAP","Délais d'instruction majorés de 2 à 4 mois","Refus probable si projet en contradiction avec le plan de gestion OGS"]},"social":{"facteurs":["Identité forte du Territoire de Belfort autour du Ballon d'Alsace","Tourisme naturel et sportif : ski, randonnée, VTT, escalade","Sensibilité des habitants et des associations à la préservation du Grand Site"],"consequences":["Opposition locale forte si projet perçu comme dégradant le Grand Site","Valorisation touristique et économique si projet s'inscrit dans la démarche OGS","Pression médiatique nationale si site labellisé menacé"]}},"actions":["Prendre contact avec le Conseil Départemental du 90 (gestionnaire de l'OGS) en amont","Consulter le plan de gestion du Grand Site Ballon d'Alsace","Intégrer une étude paysagère et d'impact visuel dans le dossier","Contacter la DREAL BFC pour un cadrage préalable si projet > 1 ha dans l'OGS"],"refs":[{"n":"C89","t":"Opération Grand Site Ballon d'Alsace"}]},{"id":"zone-reserve-naturelle","zone_types":["reserve"],"zone_layers":["biodiversite"],"zone_distance":0,"types_projets":["logement","zae","energie","transport","agriculture","nature"],"nom":"Réserve Naturelle Nationale — Protection maximale","ico":"🦅","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est dans ou à proximité de la Réserve Naturelle Nationale des Ballons des Vosges","Habitats naturels d'intérêt européen : tourbières, pelouses d'altitude, forêts de hêtres-sapins","Espèces protégées : Grand Tétras, Faucon pèlerin, Lynx, Castor d'Europe"],"consequences":["Interdiction de principe des travaux de construction dans le cœur de réserve","Autorisation exceptionnelle du préfet requise pour tout aménagement","Impact sur les espèces protégées = dérogation CNPN obligatoire"]},"economique":{"facteurs":["Coût des études naturalistes réglementaires : 20 000 à 80 000 €","Dérogation espèces protégées : procédure longue et coûteuse (6 à 18 mois)","Risque financier majeur : projet potentiellement non réalisable dans le cœur de réserve"],"consequences":["Abandon ou déplacement du projet si localisé dans le cœur de la réserve","Budget études multiplié par 3 à 5 par rapport à un site ordinaire","Valeur patrimoniale du site préservé : bénéfice économique indirect pour le tourisme"]},"politique":{"facteurs":["Code de l'environnement L332-1 à L332-27 : protection réglementaire absolue","Plan de gestion de la RNN Ballons des Vosges approuvé par arrêté ministériel","DREAL BFC : autorité gestionnaire, consultation obligatoire"],"consequences":["Refus garanti si projet dans le cœur de réserve sans dérogation ministérielle","Instruction par le Ministère de l'Environnement si projet impactant","Procédure contentieuse quasi-systématique si autorisation accordée à tort"]},"social":{"facteurs":["RNN Ballons des Vosges : patrimoine naturel reconnu à l'échelle nationale","Tourisme scientifique et naturaliste : activité économique locale","Mobilisation forte des associations de protection de la nature"],"consequences":["Opposition nationale des associations si projet dans la réserve","Valorisation territoriale exceptionnelle si projet de renaturation compatible","Sensibilisation des jeunes publics et éducation à l'environnement"]}},"actions":["Vérifier si le projet est dans le cœur ou en périphérie de la réserve (DREAL BFC)","Consulter le plan de gestion de la RNN avant toute étude de faisabilité","Contacter la DREAL BFC pour une position préalable sur la faisabilité","Envisager une relocalisation du projet hors du périmètre de la réserve"],"refs":[{"n":"C52","t":"Protection patrimoine naturel"},{"n":"C55","t":"Inventaires naturels"}]},{"id":"zone-argiles","zone_types":["argiles_moyen"],"zone_layers":["risques"],"zone_distance":0,"types_projets":["logement","zae","equipement","friche"],"nom":"Retrait-gonflement des argiles — Étude géotechnique obligatoire","ico":"🧱","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est dans une zone d'aléa moyen au retrait-gonflement des argiles (loi ELAN 2018)","Phénomène amplifié par les sécheresses successives liées au changement climatique","Cycles d'humidification/dessiccation des sols argileux provoquant des mouvements différentiels"],"consequences":["Fissuration des murs, décollement des façades, rupture des réseaux enterrés","Dommages estimés à 1,5 Md€/an en France, en forte hausse depuis 2017","Sinistres concentrés sur les constructions sans étude géotechnique préalable"]},"economique":{"facteurs":["Étude géotechnique G1+G2 obligatoire avant dépôt du PC (loi ELAN 2018) : 3 000 à 8 000 €","Surcoût des fondations adaptées (longrines, radier, puits) : 5 000 à 20 000 €","Sinistres argiles : coût moyen de 15 000 à 50 000 € par maison sinistrée"],"consequences":["Obligation légale générant un surcoût non négociable mais évitant des sinistres coûteux","Garantie décennale invalidée si étude G2 absente en zone exposée","Indemnisation via assurance catastrophe naturelle après arrêté préfectoral CatNat"]},"politique":{"facteurs":["Loi ELAN 2018 : études G1+G2 obligatoires pour les maisons individuelles en zone exposée","Arrêté de catastrophe naturelle requis pour l'indemnisation assurance","PC non instruit si étude géotechnique absente dans les zones d'exposition forte"],"consequences":["Instruction du PC conditionnée à la fourniture de l'étude géotechnique","Responsabilité du constructeur engagée en cas de sinistre sans étude","Contrôle possible par la DDT 90 lors de l'instruction du permis"]},"social":{"facteurs":["Impact psychologique sur les propriétaires face aux fissures évolutives","Litige fréquent constructeur/propriétaire sur l'origine des désordres","3,4 millions de maisons individuelles exposées au risque argiles en France"],"consequences":["Stress et dévalorisation du bien résidentiel si sinistre non indemnisé","Procédures judiciaires longues (5 à 10 ans) pour l'indemnisation des sinistres","Besoin d'information des propriétaires sur les mesures préventives simples"]}},"actions":["Commander obligatoirement une étude G1 + G2 auprès d'un géotechnicien avant le PC","Appliquer les mesures constructives : fondations profondes, drainage périphérique","Éviter les plantations d'arbres gourmands en eau à moins de 5 m du bâtiment","Consulter la carte BRGM retrait-gonflement argiles : argiles.fr"],"refs":[{"n":"C61","t":"Aléa retrait-gonflement argiles"}]},{"id":"zone-captage-aep","zone_types":["captage_aep"],"zone_layers":["eau"],"zone_distance":500,"types_projets":["logement","zae","equipement","agriculture","transport","friche"],"nom":"Captage AEP — Périmètre de protection de l'eau potable","ico":"🚰","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est à moins de 500 m d'un captage d'alimentation en eau potable (AEP)","Périmètre de protection immédiate (PPI), rapprochée (PPR) ou éloignée (PPE) potentiellement applicable","Captages Savoureuse et Allaine : alimentation en eau potable de Belfort et des communes environnantes"],"consequences":["Interdiction de toute activité polluante dans le périmètre de protection immédiate","Restrictions sévères dans le périmètre rapproché (stockage, épandage, assainissement)","Pollution accidentelle pouvant rendre le captage inutilisable et priver d'eau des milliers d'habitants"]},"economique":{"facteurs":["Coût de dépollution d'un captage contaminé : de 500 000 € à plusieurs millions d'euros","Restrictions imposées par le PPR pouvant rendre certains projets non réalisables","Coût des études hydrogéologiques pour les projets dans les PPR : 5 000 à 20 000 €"],"consequences":["Refus systématique dans le périmètre immédiat pour toute activité potentiellement polluante","Prescriptions spéciales dans le PPR : surcoût de 5 à 15 % du coût total du projet","Responsabilité financière illimitée du pollueur si contamination du captage avérée"]},"politique":{"facteurs":["Code de la santé publique art. L1321-2 : périmètres de protection obligatoires","DUP (Déclaration d'Utilité Publique) des périmètres : annexée au PLU","Consultation ARS BFC obligatoire pour tout projet dans les périmètres de protection"],"consequences":["Avis conforme de l'ARS BFC requis : son refus bloque le permis","Arrêté préfectoral fixant les activités interdites et réglementées dans les périmètres","Hydrogéologue agréé obligatoire pour les études d'impact sur les périmètres"]},"social":{"facteurs":["Santé publique : qualité de l'eau potable pour les 145 000 habitants du Territoire de Belfort","Droit à l'eau potable : enjeu de santé publique fondamental","Confiance des habitants dans la qualité de l'eau du robinet"],"consequences":["Coupure d'eau ou mise hors service du captage si contamination : impact sur toute la population desservie","Coût de substitution (eau en bouteille, approvisionnement alternatif) très élevé","Procès et indemnisations des victimes si pollution avérée liée au projet"]}},"actions":["Identifier précisément les périmètres de protection du captage (DDT 90 ou ARS BFC)","Consulter l'ARS BFC AVANT tout dépôt de permis si le projet est dans un périmètre","Éviter tout stockage de produits dangereux, assainissement non conforme ou déversement","Contacter ARS BFC : 03 63 35 34 00 — ars-bfc-dt90@ars.sante.fr"],"refs":[{"n":"C48","t":"Prélèvements eau et captages AEP"}]},{"id":"zone-sismique-2","zone_types":["sismique_2"],"zone_layers":["risques"],"zone_distance":0,"types_projets":["equipement","logement","zae"],"nom":"Zone de sismicité 2 — Règles parasismiques applicables","ico":"🌋","niv":"faible","tmin":2,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Zone de sismicité 2 (faible) : plaine de Belfort, plateaux du Jura et Sundgau","Risque sismique modéré mais réel pour les bâtiments de grande capacité","Historique : séismes de magnitude 3 à 4 régulièrement ressentis"],"consequences":["Risque limité pour les constructions légères mais significatif pour les ERP","Amplification possible sur les terrains alluviaux saturés (effet de site)"]},"economique":{"facteurs":["Surcoût parasismique limité en zone 2 : moins de 2 % du coût du gros œuvre","Études géotechniques recommandées pour les ERP en zone 2"],"consequences":["Impact budgétaire minimal mais obligatoire pour certaines catégories de bâtiments","Contrôle technique requis pour les ERP de catégories III et IV"]},"politique":{"facteurs":["Décret du 22 octobre 2010 : zonage sismique réglementaire, zone 2 = aléa faible","Eurocode 8 applicable à partir de la catégorie d'importance II en zone 2","Arrêté du 22 octobre 2010 : règles de construction applicables"],"consequences":["ERP de grandes capacités (catégories III, IV) soumis aux règles parasismiques en zone 2","Contrôle technique obligatoire pour les IGH et ERP de catégorie IV"]},"social":{"facteurs":["Faible perception du risque sismique dans la plaine de Belfort","ERP accueillant du public : responsabilité de sécurité des usagers"],"consequences":["Protection des occupants via les règles parasismiques même en aléa faible","Sensibilisation recommandée pour les gestionnaires d'ERP"]}},"actions":["Vérifier la catégorie d'importance du bâtiment (I à IV) pour déterminer les obligations","Appliquer l'Eurocode 8 pour les ERP de catégories II à IV","Consulter un bureau d'études structure pour les bâtiments > R+3 ou ERP en zone 2"],"refs":[{"n":"C59","t":"Risque sismique — zones 2 et 3"}]},{"id":"zone-bruit","zone_types":["bruit_1","trafic_fort"],"zone_layers":["mobilite"],"zone_distance":0,"types_projets":["logement","equipement","zae"],"nom":"Secteur affecté par le bruit des transports","ico":"🔊","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est dans un secteur affecté par le bruit des infrastructures de transport (A36, RN19)","Niveaux sonores dépassant 65 dB(A) en façade dans les zones les plus exposées","Pollution atmosphérique liée aux axes routiers : NO2, PM10, PM2.5"],"consequences":["Obligation d'isolation acoustique renforcée pour tous les logements et ERP","Impact sur la santé des futurs occupants : troubles du sommeil, maladies cardiovasculaires","Qualité de l'air dégradée à moins de 200 m des axes à fort trafic"]},"economique":{"facteurs":["Isolation acoustique renforcée (catégorie 1 : DnT,A ≥ 40 dB) : 5 000 à 20 000 € par logement","VMC double flux avec filtration anti-pollution recommandée : 3 000 à 8 000 €","Dépréciation de la valeur vénale des biens dans les zones très exposées"],"consequences":["Surcoût de construction de 3 à 8 % pour respecter les exigences acoustiques","Réduction de la valeur locative et vénale si bruit résiduel perçu","Attestation acoustique obligatoire : coût d'étude de 500 à 2 000 €"]},"politique":{"facteurs":["Classement sonore des voies : arrêté préfectoral annexé au PLU — opposable","Attestation acoustique obligatoire à joindre au PC pour les logements (décret 2011-604)","Norme NF S 31-010 et arrêté du 25 avril 2003 sur les objectifs d'isolation"],"consequences":["Permis refusé si attestation acoustique absente pour les logements","Réception de chantier conditionnée aux mesures acoustiques in situ","Obligation d'information des futurs acquéreurs sur le classement sonore"]},"social":{"facteurs":["OMS : exposition chronique > 65 dB(A) augmente le risque cardiovasculaire de 20 %","Inégalités sociales d'exposition : logements sociaux souvent proches des axes routiers","Gêne sonore : premier facteur de nuisance déclaré par les Français"],"consequences":["Perturbation du sommeil, stress chronique, difficultés de concentration pour les occupants","Obligation de conception bioclimatique avec pièces de vie orientées côté calme","Plan de prévention du bruit dans l'environnement (PPBE) : mesures de résorption prévues"]}},"actions":["Consulter l'annexe bruit du PLU (classement sonore des voies) avant le dépôt du PC","Commander une étude acoustique par un bureau agréé dès l'avant-projet (obligatoire)","Orienter les chambres et séjours du côté calme (opposé à la voie bruyante)","Prévoir une VMC double flux avec filtration si axe < 200 m"],"refs":[{"n":"C84","t":"Carte stratégique bruit"},{"n":"C85","t":"Classement sonore voies"},{"n":"C82","t":"Trafic routier"}]},{"id":"zone-qpv","zone_types":["qpv"],"zone_layers":["habitat"],"zone_distance":0,"types_projets":["logement","equipement","zae","friche"],"nom":"Quartier Prioritaire de la Ville (QPV) — Politique de la ville","ico":"🏘","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est localisé dans un Quartier Prioritaire de la Ville du Territoire de Belfort","7 QPV dans le 90 (révision 2024) : Résidences Belfort, Offemont, Bavilliers, Valdoie","Enjeux de renouvellement urbain : désimperméabilisation, végétalisation, espaces de vie"],"consequences":["Opportunité de renaturation urbaine finançable via le Fonds vert (volet cadre de vie)","Amélioration de la biodiversité urbaine si végétalisation des espaces communs","Réduction des îlots de chaleur urbains par les aménagements paysagers"]},"economique":{"facteurs":["Aides ANRU (Agence Nationale pour la Rénovation Urbaine) pour les projets de rénovation","Exonérations fiscales ZFU-TE pour les entreprises s'installant dans les QPV","Programme national Action Cœur de Ville pour Belfort (financements dédiés)"],"consequences":["Financements complémentaires disponibles si projet cohérent avec le contrat de ville","Attractivité commerciale parfois réduite dans les QPV stigmatisés","Valorisation à long terme si projet de qualité intégré à la stratégie de rénovation"]},"politique":{"facteurs":["Contrat de ville du Territoire de Belfort : gouvernance EPCI + État + associations","Programme ANRU : projets de rénovation urbaine des QPV cofinancés par l'État","Obligation de concertation avec les habitants pour les projets ANRU"],"consequences":["Accès aux financements ANRU et Fonds vert si projet validé par le contrat de ville","Concertation obligatoire avec les habitants : délais de concertation à prévoir","Cohérence exigée avec la stratégie locale de politique de la ville"]},"social":{"facteurs":["Populations confrontées aux inégalités : chômage, précarité, mixité sociale insuffisante","15 200 habitants en QPV dans le Territoire de Belfort (données 2024)","Besoins en équipements, services de proximité, espaces verts et sécurité"],"consequences":["Amélioration de la qualité de vie si projet de qualité bien concerté avec les habitants","Risque de gentrification si rénovation sans maintien du parc social","Renforcement du lien social et de la sécurité si espaces publics de qualité"]}},"actions":["Contacter Grand Belfort (service politique de la ville) pour les financements ANRU disponibles","Vérifier si le projet est éligible au Fonds vert volet cadre de vie et renouvellement urbain","Organiser une concertation avec les habitants du quartier dès la phase de conception","Intégrer une démarche de mixité fonctionnelle (logements, commerces, équipements)"],"refs":[{"n":"C80","t":"Quartiers prioritaires de la ville (QPV)"}]},{"id":"zone-sage-allan","zone_types":["sage"],"zone_layers":["eau"],"zone_distance":0,"types_projets":["zae","equipement","energie","transport","agriculture","friche"],"nom":"SAGE Allan — Compatibilité eau obligatoire","ico":"💧","niv":"moyen","tmin":2,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est dans le périmètre du SAGE Allan (Schéma d'Aménagement et de Gestion des Eaux)","SAGE Allan couvre l'ensemble du Territoire de Belfort et ses bassins versants","Seulement 15 % des masses d'eau du 90 en bon état écologique — objectif DCE 2027"],"consequences":["Obligation de compatibilité du projet avec les orientations du SAGE Allan","Vigilance sur les rejets d'eaux pluviales, les prélèvements et l'imperméabilisation","Dossier loi sur l'eau (IOTA) potentiellement requis selon l'impact hydraulique du projet"]},"economique":{"facteurs":["Coût des études hydrauliques si projet près d'un cours d'eau (IOTA) : 5 000 à 30 000 €","Financement Agence de l'eau RMC possible pour les projets de restauration ou renaturation","Investissement dans les systèmes de rétention et traitement des eaux pluviales"],"consequences":["Budget études majoré si dossier IOTA requis","Financement partiel possible pour les projets vertueux (Agence de l'eau)","Coût de mise en conformité des réseaux d'eaux pluviales si projet d'extension"]},"politique":{"facteurs":["SAGE Allan approuvé : règlement opposable aux tiers depuis 2015","Commission Locale de l'Eau (CLE) : instance de gouvernance du SAGE","DDT 90 (police de l'eau) : contrôle de la compatibilité des projets avec le SAGE"],"consequences":["Compatibilité du PLU, des SCoT et des PC avec le SAGE obligatoire","Instruction du dossier IOTA avec consultation de la CLE pour les projets impactants","Refus de permis si incompatibilité avérée avec le règlement du SAGE"]},"social":{"facteurs":["Enjeu transfrontalier : gestion partagée de l'eau avec la Suisse et le Doubs","Qualité de l'eau potable pour 145 000 habitants du Territoire de Belfort","Activités récréatives liées à l'eau (pêche, baignade, canoë)"],"consequences":["Coopération internationale indispensable pour l'amélioration de l'état des masses d'eau","Santé publique directement liée à la qualité des captages AEP en aval","Valeur touristique des cours d'eau liée à leur qualité écologique"]}},"actions":["Vérifier la compatibilité du projet avec les orientations fondamentales du SAGE Allan","Contacter la DDT 90 (service eau) pour connaître les obligations spécifiques au projet","Déposer un dossier IOTA si le projet affecte le régime hydraulique ou la qualité de l'eau","Consulter la CLE (Commission Locale de l'Eau) pour les projets d'envergure"],"refs":[{"n":"C43","t":"SAGE Allan"},{"n":"C44","t":"État écologique masses d'eau"}]},{"id":"zone-moustique-tigre","zone_types":["moustique"],"zone_layers":["patrimoine"],"zone_distance":0,"types_projets":["logement","equipement","zae","nature"],"nom":"Zone de surveillance moustique tigre — Enjeu sanitaire","ico":"🦟","niv":"faible","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est dans la zone de surveillance active du moustique tigre (Aedes albopictus — Atlas C91)","Présence confirmée en Nord Franche-Comté depuis 2023, en expansion vers le nord","Eaux stagnantes sur l'emprise du projet = gîtes larvaires potentiels"],"consequences":["Vecteur de dengue, chikungunya et zika : 5 cas de dengue importés en NFC en 2024","Obligation de supprimer tout gîte larvaire sur l'emprise du projet","Confort d'usage dégradé si moustique tigre non pris en compte dans la conception"]},"economique":{"facteurs":["Coût de démoustication professionnelle si prolifération : 1 000 à 5 000 €/an","Conception paysagère à adapter : éviter les pièges à eau stagnante (soucoupes, bassin sans circulation)"],"consequences":["Surcoût de gestion des espaces extérieurs si gîtes larvaires non maîtrisés","Responsabilité du gestionnaire si gîtes non traités entraînent une nuisance sanitaire"]},"politique":{"facteurs":["Signalement obligatoire à l'ARS BFC en cas de foyer de dengue locale","Plan national de lutte contre le moustique tigre (ANSES) : signalement sur signalement-moustique.anses.fr"],"consequences":["Obligation du gestionnaire de traiter les gîtes larvaires sur l'emprise","Responsabilité administrative si nuisance sanitaire liée à un gîte non traité"]},"social":{"facteurs":["Nuisance croissante pour les usagers des espaces extérieurs en été","Risque sanitaire faible actuellement mais en progression avec le changement climatique","Sensibilisation des occupants et des gestionnaires recommandée"],"consequences":["Inconfort des usagers si espaces extérieurs infestés en été","Information et sensibilisation des futurs occupants sur les gestes préventifs","Contribution à la lutte collective contre la propagation de l'espèce"]}},"actions":["Éliminer tout gîte à eau stagnante dans la conception (soucoupes, gouttières bouchées, creux de terrasse)","Utiliser des fontaines ou bassins avec circulation d'eau active","Signaler les gîtes à l'ARS BFC ou sur signalement-moustique.anses.fr","Former le personnel d'entretien à la détection et l'élimination des gîtes larvaires"],"refs":[{"n":"C91","t":"Moustique tigre — enjeu sanitaire"}]},{"id":"zone-feux-foret","zone_types":["feux_foret"],"zone_layers":["risques"],"zone_distance":0,"types_projets":["logement","zae","equipement","nature"],"nom":"Aléa feux de forêt — Obligation Légale de Débroussaillement","ico":"🔥","niv":"moyen","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est dans une zone d'aléa feux de forêt identifiée (Atlas C63, massif vosgien)","Risque de feux de végétation en hausse sous l'effet du changement climatique dans le 90","Sécheresses estivales de plus en plus fréquentes et intenses dans la région BFC"],"consequences":["Destruction totale possible du bâtiment si incendie de forêt à proximité","Obligation Légale de Débroussaillement (OLD) dans un rayon de 50 m autour des constructions","Dégradation de la biodiversité forestière post-incendie (temps de régénération : 20 à 40 ans)"]},"economique":{"facteurs":["Coût annuel du débroussaillement obligatoire : 500 à 2 000 € selon la surface","Surprime d'assurance incendie/multirisque en zone boisée classée","Coût de la réserve d'eau (citerne enterrée) si zone isolée du réseau : 5 000 à 15 000 €"],"consequences":["Obligation légale persistante sur toute la durée de vie du bâtiment","Exécution d'office par la commune si OLD non respectée (aux frais du propriétaire)","Valeur d'assurance du bien réduite si OLD non respectée"]},"politique":{"facteurs":["Code forestier art. L134-6 : Obligation Légale de Débroussaillement applicable","Arrêté préfectoral listant les communes soumises à l'OLD dans le 90","SDIS 90 : prescriptions d'accès pour les véhicules de secours (voirie de 4 m minimum)"],"consequences":["PC conditionné au respect des distances minimales aux peuplements forestiers","Arrêté de mise en demeure et astreinte si OLD non exécutée","Refus de permis possible si accès pompiers insuffisant (règlement national d'urbanisme)"]},"social":{"facteurs":["Sécurité des habitants des hameaux vosgiens en lisière de forêt","Isolement des hameaux si routes coupées par un incendie","Culture du risque incendie peu développée en zone vosgienne"],"consequences":["Risque vital pour les occupants si évacuation non préparée","Nécessité d'un plan d'évacuation pour les habitations isolées en zone boisée","Sensibilisation recommandée lors de la remise des clés aux nouveaux propriétaires"]}},"actions":["Vérifier si la commune est listée dans l'arrêté préfectoral OLD du Territoire de Belfort","Respecter l'Obligation Légale de Débroussaillement : 50 m autour de toute construction","Prévoir un accès pompiers de 4 m de large minimum sur toute la longueur de la voirie","Contacter le SDIS 90 pour les prescriptions d'accès et de défense extérieure contre l'incendie"],"refs":[{"n":"C63","t":"Aléa feux de forêts"}]},{"id":"zone-minier","zone_types":["minier"],"zone_layers":["risques"],"zone_distance":200,"types_projets":["logement","zae","equipement","transport","friche"],"nom":"Zone de risque minier — Ancienne exploitation Giromagny","ico":"⛏","niv":"eleve","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Le projet est à moins de 200 m d'une ancienne exploitation minière (mine de Giromagny — plomb, zinc, argent)","Présence de galeries souterraines pouvant s'étendre bien au-delà du périmètre connu","Risque de contamination des sols et des eaux souterraines par les résidus miniers (plomb, arsenic)"],"consequences":["Effondrement différé des terrains au-dessus des galeries (fontis) sans signe précurseur","Contamination possible des sols sous l'emprise : nécessite un diagnostic avant travaux","Impacts sur la nappe phréatique locale si galeries inondées et drainées vers l'extérieur"]},"economique":{"facteurs":["Étude de dangers miniers (BRGM) : 5 000 à 30 000 € selon l'étendue des galeries","Confortement des galeries si nécessaire : 50 000 à 500 000 € selon les travaux","Responsabilité de l'État (BRGM) si exploitant minier défaillant ou inconnu"],"consequences":["Projet potentiellement non réalisable si galeries actives sous l'emprise","Coût de dépollution des sols en surface si contamination aux métaux lourds avérée","Valeur foncière fortement réduite dans le périmètre de risque minier"]},"politique":{"facteurs":["Code minier art. L174-1 : responsabilité de l'État pour les mines abandonnées sans responsable","BRGM : gestionnaire national des risques miniers résiduels","Base de données Géorisques (anciens travaux miniers) : consultation préalable obligatoire","Possible Arrêté de Risque Minier (ARM) de la commune"],"consequences":["Refus de permis si galeries avérées sous l'emprise sans étude de dangers","Instruction de la préfecture requise en zone de risque minier identifié","Enquête publique si travaux de confortement importants nécessaires"]},"social":{"facteurs":["Mémoire minière du Territoire de Belfort : identité industrielle historique de Giromagny","Risque vital en cas d'effondrement brutal d'une galerie sous une habitation","Patrimoine minier valorisable culturellement (musée, circuit touristique)"],"consequences":["Anxiété légitime des riverains vivant au-dessus de galeries identifiées","Valorisation culturelle et touristique du patrimoine minier si bien géré","Nécessité d'information transparente des futurs acquéreurs sur le risque résiduel"]}},"actions":["Consulter la base de données des anciens travaux miniers sur Géorisques (BRGM)","Vérifier l'existence d'un Arrêté de Risque Minier (ARM) auprès de la préfecture du 90","Commander une étude de dangers miniers auprès du BRGM avant tout projet de construction","Contacter la DREAL BFC si le projet jouxte le périmètre de surveillance minière"],"refs":[{"n":"C62","t":"Risque minier — mine de Giromagny"}]},{"id":"zone-friche-nearby","zone_types":["friche"],"zone_layers":["urbanisme"],"zone_distance":100,"types_projets":["logement","zae","equipement","nature"],"nom":"Friche inventoriée à proximité — Alternative ZAN à considérer","ico":"♻","niv":"faible","tmin":1,"contexte_zone":true,"axes":{"environnement":{"facteurs":["Une friche industrielle ou commerciale est inventoriée à moins de 100 m du projet","La reconversion de friche = zéro artificialisation nette (ZAN) vs terrain vierge","Possible pollution des sols à diagnostiquer avant reconversion de la friche"],"consequences":["Choix de la friche contribue positivement au bilan ZAN de la commune","Risque de pollution résiduelle si friche non dépollue avant reconversion","Opportunité de requalification du quartier si friche reconvertie plutôt qu'abandonnée"]},"economique":{"facteurs":["Fonds Friches ADEME : financement du différentiel de coût friche vs terrain vierge (jusqu'à 80 %)","Portage foncier EPF BFC pendant la phase d'étude et de dépollution","Coût de dépollution variable : de 50 000 € à plusieurs millions selon la pollution"],"consequences":["Modèle économique viable si Fonds Friches obtenu (1 € public = 5 à 10 € investis)","Friche non valorisée = perte économique et dégradation du tissu urbain","Valeur foncière du quartier améliorée après reconversion réussie"]},"politique":{"facteurs":["Loi ZAN : obligation de justifier l'absence d'alternative sur friche avant extension sur terrain vierge","Portail BIGAN de la DDT 90 : inventaire des friches disponibles dans le 90","SCoT du Territoire de Belfort : priorité aux friches dans la politique foncière"],"consequences":["Obligation réglementaire de démontrer l'absence d'alternative en friche si consommation d'ENAF","Instruction du PC favorable si recyclage de friche plutôt que terrain vierge","Risque de refus ou de contentieux si friche disponible ignorée"]},"social":{"facteurs":["Friche abandonnée = nuisance visuelle, insécurité, dégradation de l'image du quartier","Reconversion = renouveau urbain et amélioration du cadre de vie des riverains","Mémoire industrielle locale à valoriser dans le projet architectural"],"consequences":["Amélioration du cadre de vie des riverains si friche reconvertie en espace de qualité","Appropriation du nouveau lieu par les habitants si concertation réussie","Modèle de développement durable valorisable dans la communication du projet"]}},"actions":["Consulter le portail BIGAN de la DDT 90 pour vérifier la disponibilité de la friche proche","Évaluer si la friche est mobilisable avant de choisir un terrain vierge","Déposer un dossier Fonds Friches ADEME (portail AGIR) pour le cofinancement","Contacter l'EPF BFC pour le portage foncier et l'accompagnement à la reconversion"],"refs":[{"n":"C70","t":"Réhabilitation des friches"},{"n":"C71","t":"Inventaire des friches dans le 90"}]}];

/**
 * Tente de recharger ENJEUX_ZONES depuis enjeux-data.json via fetch().
 * Sans effet si pas de serveur HTTP — les données embarquées sont utilisées.
 */
function loadEnjeuxZones() {
  return fetch('enjeux-zones.json')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (d && d.length > 0) ENJEUX_ZONES = d; })
    .catch(function(){});
}

/* ── Point-in-Polygon : rayon de Casteljau ──────────────────────
   Retourne true si le point (lat,lng) est à l'intérieur du polygon.
   Le polygon est au format GeoJSON [[[lng,lat],...]] */
/**
 * Algorithme ray-casting : teste si (lat, lng) est dans un polygone.
 * @param  {number[][]} polygonCoords  Tableau [lng, lat] (format GeoJSON)
 * @return {boolean}
 */
function pointDansPolygone(lat, lng, polygonCoords) {
  var ring = polygonCoords[0];  /* anneau extérieur */
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0], yi = ring[i][1];
    var xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/* ── Distance approximative (mètres) entre deux points ─────────
   Formule haversine simplifiée, précision suffisante pour < 50 km */
function distanceMetres(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Distance d'un point à un segment (pour LineStrings) ────── */
function distancePointSegment(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return distanceMetres(py, px, ay, ax);
  var t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx+dy*dy)));
  return distanceMetres(py, px, ay+t*dy, ax+t*dx);
}

/* ── Teste si un point est dans ou à proximité d'une feature ───
   Gère Polygon, MultiPolygon, LineString, MultiLineString, Point */
function featureContientPoint(feature, lat, lng, rayon) {
  var geom = feature.geometry;
  if (!geom) return false;
  var type = geom.type;
  var coords = geom.coordinates;

  if (type === 'Polygon') {
    if (pointDansPolygone(lat, lng, coords)) return true;
    if (rayon > 0) {
      /* Vérifier aussi la distance aux bords */
      for (var i = 0; i < coords[0].length-1; i++) {
        var d = distancePointSegment(lng,lat, coords[0][i][0],coords[0][i][1], coords[0][i+1][0],coords[0][i+1][1]);
        if (d <= rayon) return true;
      }
    }
    return false;
  }

  if (type === 'MultiPolygon') {
    return coords.some(function(poly) {
      if (pointDansPolygone(lat, lng, poly)) return true;
      if (rayon > 0) {
        for (var i = 0; i < poly[0].length-1; i++) {
          var d = distancePointSegment(lng,lat, poly[0][i][0],poly[0][i][1], poly[0][i+1][0],poly[0][i+1][1]);
          if (d <= rayon) return true;
        }
      }
      return false;
    });
  }

  if (type === 'LineString') {
    var effectif = Math.max(rayon, 1);
    for (var i = 0; i < coords.length-1; i++) {
      if (distancePointSegment(lng,lat, coords[i][0],coords[i][1], coords[i+1][0],coords[i+1][1]) <= effectif)
        return true;
    }
    return false;
  }

  if (type === 'MultiLineString') {
    var effectif = Math.max(rayon, 1);
    return coords.some(function(line){
      for (var i = 0; i < line.length-1; i++) {
        if (distancePointSegment(lng,lat, line[i][0],line[i][1], line[i+1][0],line[i+1][1]) <= effectif)
          return true;
      }
      return false;
    });
  }

  if (type === 'Point') {
    var effectif = Math.max(rayon, 100);  /* 100m minimum pour les points */
    return distanceMetres(lat, lng, coords[1], coords[0]) <= effectif;
  }

  return false;
}

/* ── Détecte les zones actives pour une position donnée ─────────
   Retourne un tableau d'objets { enjeu, zonesDetectees } */
function detecterZones(lat, lng, typeProjet) {
  if (!lat || !lng || !ENJEUX_ZONES || ENJEUX_ZONES.length === 0) return [];

  var resultats = [];

  ENJEUX_ZONES.forEach(function(enjeu) {
    /* Vérifier que ce type de projet est concerné */
    if (enjeu.types_projets.indexOf(typeProjet) === -1) return;

    var zonesDetectees = [];

    /* Pour chaque couche de l'Atlas concernée */
    enjeu.zone_layers.forEach(function(layerId) {
      var couche = COUCHES_DATA[layerId];
      if (!couche || !couche.features) return;

      couche.features.forEach(function(feature) {
        var fType = feature.properties && feature.properties.type;
        /* Vérifier si ce feature type est dans la liste zone_types de l'enjeu */
        if (enjeu.zone_types.indexOf(fType) === -1) return;

        if (featureContientPoint(feature, lat, lng, enjeu.zone_distance || 0)) {
          zonesDetectees.push({
            nom:     feature.properties.nom || fType,
            type:    fType,
            layer:   layerId,
            cat:     feature.properties.cat || '',
          });
        }
      });
    });

    if (zonesDetectees.length > 0) {
      resultats.push({ enjeu: enjeu, zones: zonesDetectees });
    }
  });

  return resultats;
}

/* ── Affiche les enjeux de zones dans un accordéon dédié ────────
   Appelé depuis rendreAccordeons() */
function rendreAccordeonZones(zonesDetectees, conteneur) {
  if (!zonesDetectees || zonesDetectees.length === 0) return;

  var accord = document.createElement('div');
  accord.className = 'accord-wrap accord-zones ouvert';
  accord.dataset.axe = 'zones';

  var niveaux = { eleve:'Elevé', moyen:'Moyen', faible:'Faible' };

  /* Header de l'accordéon zones */
  var btn = document.createElement('button');
  btn.className = 'accord-btn';
  btn.style.setProperty('--axe-color', '#b91c1c');
  btn.style.setProperty('--axe-border', '#fca5a5');
  btn.innerHTML =
    '<span class="accord-ico">📍</span>' +
    '<span class="accord-label">Contraintes de localisation détectées</span>' +
    '<span class="accord-count">' + zonesDetectees.length + ' zone' + (zonesDetectees.length > 1 ? 's' : '') + '</span>' +
    '<span class="accord-chev">&#x25BC;</span>';

  var body = document.createElement('div');
  body.className = 'accord-body';

  /* Badge d'alerte en haut */
  var alertDiv = document.createElement('div');
  alertDiv.className = 'zones-alerte-banner';
  alertDiv.innerHTML =
    '<span>⚠️</span>' +
    '<span>La position de votre projet a été analysée. ' + zonesDetectees.length +
    ' contrainte' + (zonesDetectees.length > 1 ? 's' : '') +
    ' géographique' + (zonesDetectees.length > 1 ? 's ont été détectées' : ' a été détectée') + ' :</span>';
  body.appendChild(alertDiv);

  /* Liste des zones avec chips */
  var chipWrap = document.createElement('div');
  chipWrap.className = 'zones-chips-wrap';
  zonesDetectees.forEach(function(zd) {
    var chip = document.createElement('div');
    chip.className = 'zone-chip';
    chip.innerHTML =
      '<span class="zone-chip-ico">📌</span>' +
      '<div>' +
        '<div class="zone-chip-nom">' + zd.enjeu.nom + '</div>' +
        '<div class="zone-chip-detail">' + zd.zones.map(function(z){ return z.nom; }).join(' · ') + '</div>' +
      '</div>' +
      '<span class="niv-badge n-' + zd.enjeu.niv + '">' + (niveaux[zd.enjeu.niv]||zd.enjeu.niv) + '</span>';
    chipWrap.appendChild(chip);
  });
  body.appendChild(chipWrap);

  /* Fiches détaillées pour chaque enjeu de zone */
  zonesDetectees.forEach(function(zd) {
    var enjeu = zd.enjeu;
    var axeIds = ['environnement','economique','politique','social'];
    var AXES = {
      environnement: { label:'Environnement', ico:'🌳', color:'#15803d', bg:'#f0fdf4', border:'#86efac' },
      economique:    { label:'Economique',    ico:'💰', color:'#7c3aed', bg:'#f5f3ff', border:'#c4b5fd' },
      politique:     { label:'Politique',     ico:'🏛', color:'#92400e', bg:'#fef9c3', border:'#fde68a' },
      social:        { label:'Social',        ico:'👥', color:'#be123c', bg:'#fff1f2', border:'#fda4af' },
    };

    var fiche = document.createElement('div');
    fiche.className = 'axe-fiche';

    var ficheHead = document.createElement('div');
    ficheHead.className = 'axe-fiche-head';
    ficheHead.innerHTML =
      '<span class="axe-fiche-ico">' + (enjeu.ico||'⚠️') + '</span>' +
      '<span class="axe-fiche-nom">' + enjeu.nom + '</span>' +
      '<span class="niv-badge n-' + enjeu.niv + '">' + (niveaux[enjeu.niv]||enjeu.niv) + '</span>' +
      '<span class="axe-fiche-chev">&#x25BA;</span>';

    var ficheBody = document.createElement('div');
    ficheBody.className = 'axe-fiche-body';

    /* Badge zones détectées */
    ficheBody.innerHTML =
      '<div class="zone-detected-badge">' +
        '📍 Zone détectée : ' + zd.zones.map(function(z){ return '<strong>' + z.nom + '</strong>'; }).join(', ') +
      '</div>';

    /* Les 4 axes */
    axeIds.forEach(function(axeId) {
      var meta = AXES[axeId];
      var axe  = enjeu.axes && enjeu.axes[axeId];
      if (!axe) return;

      var fHtml = (axe.facteurs||[]).map(function(f){
        return '<li><span class="axe-bullet">•</span>' + f + '</li>';
      }).join('');
      var cHtml = (axe.consequences||[]).map(function(c){
        return '<li><span class="axe-bullet axe-bullet-arrow">→</span>' + c + '</li>';
      }).join('');

      ficheBody.innerHTML +=
        '<div class="axe-section" style="border-left:3px solid ' + meta.border + ';background:' + meta.bg + ';margin-top:8px;">' +
          '<div class="axe-titre" style="color:' + meta.color + ';">' + meta.ico + '&nbsp;' + meta.label + '</div>' +
          '<div class="axe-cols">' +
            '<div class="axe-col"><div class="axe-col-titre">Facteurs</div><ul class="axe-list">' + fHtml + '</ul></div>' +
            '<div class="axe-col"><div class="axe-col-titre">Conséquences</div><ul class="axe-list">' + cHtml + '</ul></div>' +
          '</div>' +
        '</div>';
    });

    /* Actions */
    if (enjeu.actions && enjeu.actions.length) {
      var aHtml = enjeu.actions.map(function(a){
        return '<li><span class="axe-bullet action-bullet">✓</span>' + a + '</li>';
      }).join('');
      ficheBody.innerHTML +=
        '<div class="fiche-section actions" style="margin-top:8px;">' +
          '<div class="fiche-section-titre action">Actions recommandées</div>' +
          '<ul class="axe-list">' + aHtml + '</ul>' +
        '</div>';
    }

    /* Refs */
    if (enjeu.refs && enjeu.refs.length) {
      var refsHtml = enjeu.refs.map(function(r){
        return '<span class="enjeu-lien" data-id="' + enjeu.id + '">🗺 ' + r.n + ' — ' + r.t + '</span>';
      }).join('');
      ficheBody.innerHTML += '<div class="enjeu-liens" style="margin-top:8px;">' + refsHtml + '</div>';
    }

    ficheHead.addEventListener('click', function(){ fiche.classList.toggle('ouvert'); });
    fiche.appendChild(ficheHead);
    fiche.appendChild(ficheBody);
    body.appendChild(fiche);
  });

  btn.addEventListener('click', function(){ accord.classList.toggle('ouvert'); });
  accord.appendChild(btn);
  accord.appendChild(body);

  /* Insérer AVANT les autres accordéons */
  if (conteneur.firstChild) {
    conteneur.insertBefore(accord, conteneur.firstChild);
  } else {
    conteneur.appendChild(accord);
  }
}

/* Zones injection moved into lancerAnalyse */
