import type { SiteCopy } from './en';

export const fr: SiteCopy = {
  'nav.features': 'Fonctionnalités',
  'nav.guides': 'Guides par banque',
  'nav.faq': 'Questions fréquentes',
  'nav.support': 'Aide',
  'nav.privacy': 'Confidentialité',
  'nav.terms': 'Conditions',
  'nav.disclaimer': 'Avertissement',
  'nav.changelog': 'Nouveautés',
  'nav.label': 'Site',
  'footer.tagline': 'Une application de finances personnelles qui garde vos données sur votre appareil.',
  'footer.disclaimer': 'Financial Aid est un outil de budget. Il ne fournit pas de conseil financier.',
  'cta.appStore': 'Télécharger dans l’App Store',
  'cta.playStore': 'Disponible sur Google Play',
  'common.learnMore': 'En savoir plus',
  'common.screenshotAlt': '{screen} dans Financial Aid',

  'home.title': 'Une application de budget privée pour vos relevés bancaires',
  'home.description':
    'Importez le relevé CSV ou Excel de votre banque. Financial Aid classe vos transactions, suit vos budgets et vos dettes, et garde tout sur votre appareil.',
  'home.heading': 'Voyez où va votre argent, sans confier vos identifiants bancaires',
  'home.lead':
    'Importez le relevé que votre banque vous permet de télécharger. Financial Aid classe les transactions, suit vos budgets et vos dettes, et garde tout sur votre téléphone.',
  'home.screen': 'Écran d’accueil',
  'home.point1Title': 'Pas de compte',
  'home.point1Text': 'Ouvrez l’application et commencez. Il n’y a aucune inscription.',
  'home.point2Title': 'Pas de connexion à la banque',
  'home.point2Text':
    'Vous importez vous-même un fichier CSV ou Excel. L’application ne demande jamais vos identifiants bancaires.',
  'home.point3Title': 'Rien n’est envoyé',
  'home.point3Text':
    'Vos données restent dans une base de données sur votre appareil. Pas de mesure d’audience, pas de publicité.',
  'home.featuresTitle': 'Ce que fait l’application',
  'home.banksTitle': 'Fonctionne avec l’export de votre banque',
  'home.banksText':
    'Les exports de {banks} sont reconnus automatiquement. Les fichiers des autres banques sont lus en détectant les colonnes.',
  'home.banksLink': 'Comment exporter votre relevé',
  'home.moreTitle': 'Aussi dans l’application',
  'home.more1': 'Des catégories automatiques qui apprennent de vos corrections',
  'home.more2': 'Un budget mensuel par catégorie',
  'home.more3': 'Les tendances par mois, avec l’année précédente pour comparer',
  'home.more4': 'Dépenses fixes et flexibles séparées automatiquement',
  'home.more5': 'Des profils séparés, chacun avec sa devise',
  'home.more6': 'Neuf langues et six thèmes de couleur, en clair et en sombre',

  'feature.import.name': 'Import de relevés',
  'feature.import.title': 'Importez votre relevé bancaire en CSV ou Excel',
  'feature.import.summary':
    'Téléchargez le relevé auprès de votre banque, ouvrez-le dans Financial Aid, et vos transactions sont classées en quelques secondes.',
  'feature.import.p1Title': 'Lit le fichier que votre banque vous fournit',
  'feature.import.p1Text':
    'Les fichiers CSV, texte et Excel sont pris en charge. Les colonnes de date, de montant, de nom et de description sont trouvées automatiquement, et les exports de {banks} sont reconnus.',
  'feature.import.p2Title': 'Importer deux fois est sans risque',
  'feature.import.p2Text':
    'Les doublons sont ignorés : des relevés qui se chevauchent ne posent donc aucun problème. Après chaque import, vous voyez ce qui a été ajouté, les dates couvertes et ce qui a été ignoré.',
  'feature.import.p3Title': 'Directement depuis l’application de votre banque',
  'feature.import.p3Text':
    'Exportez le relevé dans l’application de votre banque, choisissez Partager puis Financial Aid. Les relevés PDF et les photos ne sont pas pris en charge ; l’application vous indique quel fichier utiliser à la place.',

  'feature.health.title': 'Un score de santé pour votre budget',
  'feature.health.summary':
    'Un score de 0 à 100 qui montre si vos finances se portent bien, et le changement qui aiderait le plus.',
  'feature.health.p1Title': 'Cinq piliers',
  'feature.health.p1Text':
    'Taux d’épargne, logement, charges fixes, remboursements de dettes et matelas de sécurité, chacun comparé à un repère courant.',
  'feature.health.p2Title': 'Des fourchettes adaptées à votre foyer',
  'feature.health.p2Text':
    'Les fourchettes de dépenses habituelles s’adaptent au nombre d’adultes et d’enfants, et au fait d’être locataire ou propriétaire. Vous pouvez accepter un niveau qui vous convient.',
  'feature.health.p3Title': 'Des alertes et un rapport mensuel',
  'feature.health.p3Text':
    'Après un import, l’application peut signaler un remboursement manqué, un nouveau prélèvement récurrent ou une hausse de prix. Le rapport mensuel est enregistré en PDF, créé sur votre appareil.',

  'feature.debts.title': 'Suivez vos prêts et voyez quand vous serez libéré de vos dettes',
  'feature.debts.summary':
    'Ajoutez un prêt ou un crédit immobilier une seule fois. Les paiements sont repris de vos relevés et le solde restant se met à jour tout seul.',
  'feature.debts.p1Title': 'Paiements associés automatiquement',
  'feature.debts.p1Text':
    'Un mot-clé associe à une dette les paiements correspondants après chaque import. Les correspondances approchantes sont listées pour que vous puissiez les ajouter à la main.',
  'feature.debts.p2Title': 'Capital et intérêts',
  'feature.debts.p2Text':
    'Chaque paiement est réparti entre capital et intérêts. Vous voyez le solde restant, les intérêts payés jusqu’ici et le mois estimé de la fin de la dette.',
  'feature.debts.p3Title': 'Suggérées à partir de vos relevés',
  'feature.debts.p3Text':
    'Un paiement mensuel régulier à un prêteur, qui ne correspond encore à aucune dette, est proposé comme nouvelle dette, avec les détails déjà remplis.',

  'feature.growth.title': 'Voyez comment votre épargne pourrait croître',
  'feature.growth.summary':
    'Saisissez un montant mensuel, un nombre d’années et un montant de départ, et voyez une estimation du solde final.',
  'feature.growth.p1Title': 'Trois scénarios',
  'feature.growth.p1Text':
    '{cautious}, {expected} et {optimistic} utilisent un rendement annuel de 5 %, 7 % et 9 %, affichés côte à côte. Vous pouvez aussi saisir votre propre rendement, vos frais et l’inflation.',
  'feature.growth.p2Title': 'Année par année',
  'feature.growth.p2Text':
    'Un graphique et un tableau montrent, pour chaque année, ce que vous avez versé et ce que la croissance a ajouté, en prix futurs ou en prix d’aujourd’hui.',
  'feature.growth.p3Title': 'Avancez vers un objectif',
  'feature.growth.p3Text':
    'Fixez un solde cible ou un revenu mensuel et voyez si vous êtes sur la bonne voie, ainsi que le montant mensuel nécessaire pour y arriver.',

  'feature.backup.title': 'Sauvegardez vos données à l’endroit de votre choix',
  'feature.backup.summary':
    'Un seul fichier contient tous vos profils. Vous décidez où il est enregistré ; l’application ne l’envoie nulle part.',
  'feature.backup.p1Title': 'Mot de passe facultatif',
  'feature.backup.p1Text':
    'Une sauvegarde avec mot de passe est chiffrée en AES-256. Un mot de passe oublié ne peut pas être récupéré, conservez-le donc en lieu sûr.',
  'feature.backup.p2Title': 'Restauration avec aperçu',
  'feature.backup.p2Text':
    'Avant tout changement, vous voyez ce que contient la sauvegarde et ce qui se trouve sur l’appareil. Les données remplacées sont conservées, la dernière restauration peut donc être annulée.',
  'feature.backup.p3Title': 'Exportez vos transactions',
  'feature.backup.p3Text':
    'Enregistrez les transactions d’un profil dans un fichier CSV ou Excel pour les utiliser ailleurs. Ce fichier est lisible et n’est pas chiffré.',

  'support.title': 'Aide',
  'support.description':
    'De l’aide pour Financial Aid : guides d’export, questions fréquentes et comment nous joindre.',
  'support.lead':
    'La plupart des questions portent sur le téléchargement d’un relevé auprès de la banque. Commencez ici.',
  'support.guidesTitle': 'Exportez votre relevé',
  'support.guidesText': 'Des guides pas à pas par banque, tirés des pages d’aide de chaque banque.',
  'support.faqTitle': 'Questions fréquentes',
  'support.faqText': 'Confidentialité, fichiers pris en charge, doublons et sauvegardes.',
  'support.contactTitle': 'Contact',
  'support.contactEmail': 'Envoyez un e-mail à {link} en décrivant ce que vous avez fait et ce qui s’est passé.',
  'support.contactIssues':
    'Ouvrez un ticket sur {link} en décrivant ce que vous avez fait et ce qui s’est passé.',
  'support.noFiles':
    'N’envoyez pas de relevés ni de sauvegardes : ils contiennent des données personnelles. Une description des colonnes du fichier suffit.',

  'changelog.title': 'Nouveautés',
  'changelog.description': 'Les changements de chaque version de Financial Aid.',
  'changelog.version': 'Version {version}',
  'changelog.v100.1': 'Import de relevés en fichiers CSV, texte et Excel, avec détection du format de la banque',
  'changelog.v100.2': 'Catégories automatiques, budgets et tendances',
  'changelog.v100.3': 'Santé du budget : score, alertes et rapport mensuel en PDF',
  'changelog.v100.4': 'Dettes avec paiements associés automatiquement',
  'changelog.v100.5': 'Calculateur de croissance future',
  'changelog.v100.6': 'Sauvegardes chiffrées et export des transactions',
  'changelog.v100.7': 'Neuf langues',
};
