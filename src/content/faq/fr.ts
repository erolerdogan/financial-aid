import type { FaqCopy } from './en';

export const fr: FaqCopy = {
  'faq.title': 'Questions fréquentes',
  'faq.description':
    'Des réponses sur l’import de relevés, les catégories, la Santé du budget, la confidentialité et les sauvegardes dans Financial Aid.',
  'faq.intro':
    'Des réponses courtes sur le fonctionnement de Financial Aid. Touchez une question pour lire sa réponse.',

  'faq.start.title': 'Premiers pas',
  'faq.start.what.q': 'Que fait Financial Aid ?',
  'faq.start.what.a':
    'L’application lit les relevés que vous téléchargez auprès de votre banque, range chaque transaction dans une catégorie et montre où va votre argent : revenus, dépenses, budgets, dettes et tendances. Pour commencer, importez un relevé depuis {settings} → {importRow}.',
  'faq.start.bank.q': 'L’application se connecte-t-elle à ma banque ?',
  'faq.start.bank.a':
    'Non. Vous téléchargez vous-même un relevé auprès de votre banque et vous importez ce fichier. L’application ne demande jamais vos identifiants bancaires et n’a aucune connexion avec votre banque.',
  'faq.start.statement.q': 'Comment obtenir un relevé auprès de ma banque ?',
  'faq.start.statement.a':
    'Téléchargez-le dans l’application ou sur le site de votre banque, au format CSV ou Excel. {settings} → {guide} indique les étapes pour chaque banque, reprises des pages d’aide de la banque elle-même, ainsi que des étapes générales pour toute autre banque.',
  'faq.start.demo.q': 'Puis-je essayer l’application sans mes propres données ?',
  'faq.start.demo.a':
    'Oui. L’écran d’accueil propose {demo} : un profil séparé avec trois mois de transactions d’exemple et deux dettes d’exemple. L’import, la sauvegarde, la réinitialisation, le changement de profil et les rappels d’import y sont désactivés. On en sort avec {exitDemo}.',

  'faq.import.title': 'Importer des relevés',
  'faq.import.files.q': 'Quels fichiers puis-je importer ?',
  'faq.import.files.a':
    'Les fichiers CSV, les fichiers texte séparés par des tabulations ou des points-virgules (.txt, .tsv) et les fichiers Excel (.xlsx, .xls). Les photos, les captures d’écran et les formats bancaires comme CAMT XML, MT940 et OFX sont refusés, avec le conseil d’utiliser l’export CSV ou Excel.',
  'faq.import.banks.q': 'Quelles banques sont prises en charge ?',
  'faq.import.banks.a':
    'Les exports de {banks} sont reconnus automatiquement. Les autres banques fonctionnent si elles proposent un téléchargement CSV ou Excel ; l’application détecte les colonnes à partir de la ligne d’en-tête.',
  'faq.import.pdf.q': 'Puis-je importer un relevé PDF ?',
  'faq.import.pdf.a':
    'Uniquement les relevés PDF d’ABN AMRO. Ils sont lus sur votre appareil, et chacun est vérifié avec ses propres totaux et soldes imprimés ; un relevé dont les montants ne concordent pas n’est pas importé. Pour les PDF scannés et pour les autres banques, utilisez l’export CSV ou Excel.',
  'faq.import.twice.q': 'Que se passe-t-il si j’importe deux fois le même relevé ?',
  'faq.import.twice.a':
    'Les transactions déjà présentes dans l’application sont ignorées : importer des relevés qui se chevauchent est donc sans risque.',
  'faq.import.share.q': 'Puis-je importer directement depuis l’application de ma banque ?',
  'faq.import.share.a':
    'Oui. Exportez le relevé dans l’application de votre banque, choisissez Partager puis Financial Aid. Le fichier est importé dans le profil actif, comme un fichier que vous choisissez vous-même.',
  'faq.import.coverage.q': 'Comment savoir si un mois est complet ?',
  'faq.import.coverage.a':
    'L’indication de relevé sur {home} montre quelle part du mois sélectionné vos relevés couvrent : pas encore de données, le mois en cours, un mois passé où il manque des jours, ou le mois entier. Un mois passé où il manque des jours figure aussi dans {forYou}.',

  'faq.categories.title': 'Catégories et budgets',
  'faq.categories.how.q': 'Comment les transactions sont-elles classées ?',
  'faq.categories.how.a':
    'À l’import, dans cet ordre : vos propres règles, ce que vous avez choisi auparavant pour le même commerçant, puis les mots-clés intégrés dans le nom du commerçant et dans le reste du texte de la banque. Si rien ne correspond, l’argent qui entre est classé dans {income} et les dépenses dans {uncategorised}. Les mots-clés intégrés sont adaptés aux banques et aux commerçants néerlandais.',
  'faq.categories.fix.q': 'Une transaction est dans la mauvaise catégorie. Comment la corriger ?',
  'faq.categories.fix.a':
    'Ouvrez la transaction et touchez sa catégorie. Votre choix est mémorisé et n’est pas écrasé par la suite. Une fois qu’un commerçant a été corrigé au moins deux fois, le plus souvent de la même façon, ses nouvelles transactions suivent votre choix.',
  'faq.categories.review.q': 'Que faire des transactions sans catégorie ?',
  'faq.categories.review.a':
    'L’écran {transactions} indique en haut combien il y en a. La liste de révision les regroupe par commerçant, les plus importants d’abord, et propose une catégorie quand c’est possible. Choisir une catégorie une fois l’applique à toutes les transactions de ce commerçant et aux prochains imports.',
  'faq.categories.fixed.q': 'Que sont les dépenses fixes et flexibles ?',
  'faq.categories.fixed.a':
    'Les dépenses fixes sont les factures qui reviennent, comme le loyer, les charges et les abonnements ; le reste est flexible. L’application les détecte d’après le comportement d’un commerçant : un rythme régulier, des montants stables et des prélèvements. Dans le détail d’une transaction, vous pouvez marquer son commerçant comme {fixed} ou {flexible}, ou revenir en arrière avec {resetAuto}.',
  'faq.categories.budget.q': 'Comment définir un budget ?',
  'faq.categories.budget.a':
    'Ouvrez {settings} → {budgets} et fixez une limite mensuelle par catégorie. Les barres de progression sur {home} et sur l’écran des budgets montrent ce que vous avez dépensé par rapport à la limite. Une limite peut aussi être fixée depuis le graphique de {trends}.',
  'faq.categories.own.q': 'Puis-je ajouter mes propres catégories et règles ?',
  'faq.categories.own.a':
    'Oui. Dans {settings} → {categories}, vous créez des catégories, vous les renommez, vous changez leur couleur, vous les supprimez et vous leur ajoutez des règles par mots-clés. Quand une règle change, les transactions que vous n’avez pas classées à la main sont triées de nouveau.',

  'faq.plan.score.q': 'Comment le score de santé est-il calculé ?',
  'faq.plan.score.a':
    'Le score va de 0 à 100 et réunit cinq piliers : taux d’épargne (30 %), logement (20 %), dépenses fixes (15 %), remboursements de dettes hors crédit immobilier (20 %) et épargne de précaution (15 %). Chaque pilier est comparé à un repère courant. Une épargne de précaution que vous n’avez pas saisie est laissée de côté, et les autres piliers se partagent son poids.',
  'faq.plan.income.q': 'Quel revenu le score de santé utilise-t-il ?',
  'faq.plan.income.a':
    'La moyenne des trois derniers mois complets de revenus dans vos relevés, ou le montant que vous saisissez vous-même. Tant qu’il n’y a pas de mois avec des revenus, aucun score n’est affiché.',
  'faq.plan.debts.q': 'Comment l’application trouve-t-elle mes remboursements de dettes ?',
  'faq.plan.debts.a':
    'Chaque dette a des mots-clés. Après chaque import, une transaction est associée quand un mot-clé correspond à un mot entier et que le montant est proche de la mensualité. Les cas approchants sont listés comme correspondances possibles à ajouter à la main, et un paiement associé peut être dissocié.',
  'faq.plan.growth.q': 'Que montre {growth} ?',
  'faq.plan.growth.a':
    'Comment un montant de départ et un versement mensuel pourraient croître au fil des années. Les trois scénarios utilisent un rendement annuel de 5 %, 7 % et 9 % ; vous pouvez aussi saisir votre propre rendement, vos frais et l’inflation. Le résultat est une projection, pas une promesse.',
  'faq.plan.advice.q': 'Le score de santé ou le calculateur de croissance sont-ils un conseil financier ?',
  'faq.plan.advice.a':
    'Non. Le score de santé compare vos dépenses à des repères courants, et le calculateur de croissance affiche une projection qui n’est pas garantie. Ni l’un ni l’autre ne constitue un conseil financier.',

  'faq.privacy.title': 'Confidentialité et sauvegardes',
  'faq.privacy.where.q': 'Où mes données sont-elles stockées ?',
  'faq.privacy.where.a':
    'Dans une base de données sur votre appareil. Il n’y a ni compte ni serveur qui reçoit vos données, et l’application ne contient ni mesure d’audience ni publicité.',
  'faq.privacy.lost.q': 'Et si je perds mon téléphone ou si je supprime l’application ?',
  'faq.privacy.lost.a':
    'Vos données n’existent que sur votre appareil ; sans sauvegarde, elles ne peuvent donc pas être récupérées. Faites régulièrement une sauvegarde et conservez-la en lieu sûr ; l’application vous le rappelle au bout de 30 jours.',
  'faq.privacy.backup.q': 'Comment faire une sauvegarde ou passer à un nouveau téléphone ?',
  'faq.privacy.backup.a':
    '{settings} → {backup} enregistre un fichier avec tous vos profils, et vous choisissez où il va. Sur le nouveau téléphone, choisissez {restore} sur l’écran d’accueil. Une restauration remplace tout ce qui se trouve sur l’appareil, rien n’est fusionné, et l’application montre d’abord ce qui va changer. {undo} fait revenir les données remplacées.',
  'faq.privacy.password.q': 'J’ai oublié le mot de passe de ma sauvegarde. Peut-on le réinitialiser ?',
  'faq.privacy.password.a':
    'Non. Une sauvegarde avec mot de passe est chiffrée, et sans le mot de passe personne ne peut l’ouvrir, pas même nous. Conservez le mot de passe en lieu sûr, ou faites une nouvelle sauvegarde tant que les données sont encore sur votre appareil.',
  'faq.privacy.delete.q': 'Comment supprimer toutes mes données ?',
  'faq.privacy.delete.a':
    '{settings} → {reset} supprime toutes les données et tous les profils de l’appareil. Supprimer l’application efface aussi sa base de données. Les fichiers de sauvegarde que vous avez enregistrés ailleurs, c’est à vous de les supprimer.',

  'faq.profiles.title': 'Profils et réglages',
  'faq.profiles.what.q': 'Que sont les profils ?',
  'faq.profiles.what.a':
    'Des comptabilités séparées dans une seule application, par exemple personnel, professionnel et foyer. Chaque profil a ses propres transactions, catégories, règles, budgets et dettes, ainsi que son nom, sa couleur et sa devise. Un relevé est importé dans le profil actif.',
  'faq.profiles.currency.q': 'Que se passe-t-il quand je change de devise ?',
  'faq.profiles.currency.a':
    'Les montants déjà enregistrés dans le profil sont convertis avec des taux fixes intégrés à l’application, et non avec les taux de change du moment ; le résultat est donc approximatif.',
  'faq.profiles.languages.q': 'Quelles devises et quelles langues sont disponibles ?',
  'faq.profiles.languages.a':
    'Devises : EUR, USD, GBP, JPY, CHF, CAD et AUD. Langues : anglais, néerlandais, allemand, turc, espagnol, français, italien, portugais et russe.',
  'faq.profiles.notifications.q': 'Quand l’application envoie-t-elle des notifications ?',
  'faq.profiles.notifications.a':
    'Des rappels d’import le 15 et le 28 de chaque mois, annulés dès que vous importez un relevé, et les alertes de {health} que vous avez activées. Toutes sont programmées sur votre appareil. Les rappels se désactivent dans {settings} → {reminders}.',
};
