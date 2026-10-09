import type { FaqCopy } from './en';

export const nl: FaqCopy = {
  'faq.title': 'Veelgestelde vragen',
  'faq.description':
    'Antwoorden over het importeren van afschriften, categorieën, Budgetgezondheid, privacy en back-ups in Financial Aid.',
  'faq.intro': 'Korte antwoorden over hoe Financial Aid werkt. Tik op een vraag om het antwoord te lezen.',

  'faq.start.title': 'Aan de slag',
  'faq.start.what.q': 'Wat doet Financial Aid?',
  'faq.start.what.a':
    'De app leest de afschriften die je bij je bank downloadt, zet elke transactie in een categorie en laat zien waar je geld naartoe gaat: inkomsten, uitgaven, budgetten, schulden en trends. Begin met het importeren van een afschrift via {settings} → {importRow}.',
  'faq.start.bank.q': 'Maakt de app verbinding met mijn bank?',
  'faq.start.bank.a':
    'Nee. Je downloadt zelf een afschrift bij je bank en importeert dat bestand. De app vraagt nooit om je bankgegevens en heeft geen verbinding met je bank.',
  'faq.start.statement.q': 'Hoe kom ik aan een afschrift van mijn bank?',
  'faq.start.statement.a':
    'Download het in de app of op de website van je bank als CSV- of Excel-bestand. {settings} → {guide} toont de stappen per bank, overgenomen van de hulppagina’s van de bank zelf, en algemene stappen voor elke andere bank.',
  'faq.start.demo.q': 'Kan ik de app proberen zonder mijn eigen gegevens?',
  'faq.start.demo.a':
    'Ja. Op het welkomstscherm staat {demo}: een apart profiel met drie maanden aan voorbeeldtransacties en twee voorbeeldschulden. Importeren, back-up, resetten, van profiel wisselen en importherinneringen staan daar uit. Het plan onder Toekomstige groei kan daar niet worden gewijzigd. Je verlaat de demo met {exitDemo}.',

  'faq.import.title': 'Afschriften importeren',
  'faq.import.files.q': 'Welke bestanden kan ik importeren?',
  'faq.import.files.a':
    'CSV-bestanden, tekstbestanden met tabs of puntkomma’s (.txt, .tsv) en Excel-bestanden (.xlsx, .xls). Foto’s, schermafbeeldingen en bankformaten zoals CAMT XML, MT940 en OFX worden geweigerd, met de tip om de CSV- of Excel-export te gebruiken.',
  'faq.import.banks.q': 'Welke banken worden ondersteund?',
  'faq.import.banks.a':
    'De exports van {banks} worden automatisch herkend. Andere banken werken als ze een CSV- of Excel-download aanbieden; de app herkent de kolommen aan de kopregel.',
  'faq.import.pdf.q': 'Kan ik een pdf-afschrift importeren?',
  'faq.import.pdf.a':
    'Alleen pdf-afschriften van ABN AMRO. Ze worden op je toestel gelezen en elk afschrift wordt gecontroleerd met zijn eigen afgedrukte totalen en saldi; een afschrift dat niet klopt, wordt niet geïmporteerd. Gebruik voor gescande pdf’s en voor andere banken de CSV- of Excel-export.',
  'faq.import.twice.q': 'Wat gebeurt er als ik hetzelfde afschrift twee keer importeer?',
  'faq.import.twice.a':
    'Transacties die al in de app staan, worden overgeslagen. Overlappende afschriften importeren kan dus geen kwaad.',
  'faq.import.share.q': 'Kan ik direct vanuit mijn bankapp importeren?',
  'faq.import.share.a':
    'Ja. Exporteer het afschrift in je bankapp, kies Delen en kies Financial Aid. Het bestand wordt in het actieve profiel geïmporteerd, net als een bestand dat je zelf kiest.',
  'faq.import.coverage.q': 'Hoe weet ik of een maand compleet is?',
  'faq.import.coverage.a':
    'Het afschriftlabel op {home} laat zien hoeveel van de gekozen maand je afschriften dekken: nog geen gegevens, de lopende maand, een voorbije maand waarin dagen ontbreken, of de hele maand. Een voorbije maand waarin dagen ontbreken staat ook onder {forYou}.',

  'faq.categories.title': 'Categorieën en budgetten',
  'faq.categories.how.q': 'Hoe worden transacties ingedeeld?',
  'faq.categories.how.a':
    'Bij het importeren, in deze volgorde: je eigen regels, wat je eerder voor dezelfde winkel koos, daarna ingebouwde trefwoorden in de naam van de winkel en in de rest van de banktekst. Als niets past, wordt geld dat binnenkomt {income} en worden uitgaven {uncategorised}. De ingebouwde trefwoorden zijn afgestemd op Nederlandse banken en winkels.',
  'faq.categories.fix.q': 'Een transactie staat in de verkeerde categorie. Hoe pas ik dat aan?',
  'faq.categories.fix.a':
    'Open de transactie en tik op de categorie. Je keuze wordt onthouden en later niet overschreven. Als je een winkel minstens twee keer hebt verbeterd, meestal op dezelfde manier, volgen nieuwe transacties van die winkel jouw keuze.',
  'faq.categories.review.q': 'Wat doe ik met transacties zonder categorie?',
  'faq.categories.review.a':
    'Het scherm {transactions} toont bovenaan hoeveel het er zijn. De controlelijst groepeert ze per winkel, de grootste eerst, en stelt waar mogelijk een categorie voor. Eén keer een categorie kiezen geldt voor alle transacties van die winkel en voor volgende imports.',
  'faq.categories.fixed.q': 'Wat zijn vaste en flexibele kosten?',
  'faq.categories.fixed.a':
    'Vaste kosten zijn rekeningen die terugkomen, zoals huur, energie en abonnementen; de rest is flexibel. De app herkent ze aan het gedrag van een winkel: een vast ritme, stabiele bedragen en incasso’s. In het detail van een transactie kun je de winkel op {fixed} of {flexible} zetten, of teruggaan met {resetAuto}.',
  'faq.categories.budget.q': 'Hoe stel ik een budget in?',
  'faq.categories.budget.a':
    'Open {settings} → {budgets} en stel per categorie een maandlimiet in. Voortgangsbalken op {home} en op het budgetscherm tonen wat je hebt uitgegeven tegenover de limiet. Een limiet kun je ook instellen vanuit de grafiek op {trends}.',
  'faq.categories.own.q': 'Kan ik eigen categorieën en regels toevoegen?',
  'faq.categories.own.a':
    'Ja. Onder {settings} → {categories} maak je categorieën aan, geef je ze een andere naam of kleur, verwijder je ze en voeg je trefwoordregels toe. Als een regel verandert, worden de transacties die je niet met de hand hebt ingedeeld opnieuw gesorteerd.',

  'faq.plan.score.q': 'Hoe wordt de gezondheidsscore berekend?',
  'faq.plan.score.a':
    'De score loopt van 0 tot 100 en combineert vijf pijlers: spaarquote (30%), wonen (20%), vaste kosten (15%), schuldbetalingen zonder de hypotheek (20%) en een buffer (15%). Elke pijler wordt vergeleken met een gangbare vuistregel. Een buffer die je niet hebt ingevuld telt niet mee; de andere pijlers verdelen dan zijn gewicht.',
  'faq.plan.income.q': 'Welk inkomen gebruikt de gezondheidsscore?',
  'faq.plan.income.a':
    'Het gemiddelde van de laatste drie volledige maanden met inkomsten in je afschriften, of het bedrag dat je zelf invult. Zolang er geen maand met inkomsten is, wordt er geen score getoond. Een uitbetaalde lening of een andere grote eenmalige betaling telt niet als inkomen.',
  'faq.plan.debts.q': 'Hoe vindt de app mijn schuldbetalingen?',
  'faq.plan.debts.a':
    'Elke schuld heeft trefwoorden. Na elke import wordt een transactie gekoppeld als een trefwoord overeenkomt met een heel woord en het bedrag dicht bij de maandbetaling ligt. Wat er net naast zit, staat als mogelijke match in de lijst en kun je met de hand toevoegen; een gekoppelde betaling kun je weer ontkoppelen.',
  'faq.plan.growth.q': 'Wat laat {growth} zien?',
  'faq.plan.growth.a':
    'Hoe een startbedrag en een maandelijkse inleg in de loop van de jaren kunnen groeien. De drie scenario’s rekenen met een jaarlijks rendement van 5%, 7% en 9%; je kunt ook je eigen rendement, kosten en inflatie invullen. De uitkomst is een prognose, geen belofte.',
  'faq.plan.advice.q': 'Is de gezondheidsscore of de groeicalculator financieel advies?',
  'faq.plan.advice.a':
    'Nee. De gezondheidsscore vergelijkt je uitgaven met gangbare vuistregels, en de groeicalculator toont een prognose zonder garantie. Geen van beide is financieel advies.',

  'faq.privacy.title': 'Privacy en back-ups',
  'faq.privacy.where.q': 'Waar worden mijn gegevens bewaard?',
  'faq.privacy.where.a':
    'In een database op je toestel. Er is geen account en geen server die je gegevens ontvangt, en de app bevat geen analytics of advertenties.',
  'faq.privacy.lost.q': 'Wat als ik mijn telefoon kwijtraak of de app verwijder?',
  'faq.privacy.lost.a':
    'Je gegevens staan alleen op je toestel en zijn zonder back-up dus niet terug te halen. Maak regelmatig een back-up en bewaar die op een veilige plek; de app herinnert je er na 30 dagen aan.',
  'faq.privacy.backup.q': 'Hoe maak ik een back-up of stap ik over naar een nieuwe telefoon?',
  'faq.privacy.backup.a':
    '{settings} → {backup} bewaart één bestand met al je profielen, en jij kiest waar het komt te staan. Kies op de nieuwe telefoon {restore} op het welkomstscherm. Terugzetten vervangt alles op het toestel, er wordt niets samengevoegd, en de app laat eerst zien wat er verandert. Met {undo} haal je de vervangen gegevens terug.',
  'faq.privacy.password.q': 'Ik ben het wachtwoord van mijn back-up vergeten. Kan het opnieuw worden ingesteld?',
  'faq.privacy.password.a':
    'Nee. Een back-up met wachtwoord is versleuteld en zonder het wachtwoord kan niemand hem openen, ook wij niet. Bewaar het wachtwoord op een veilige plek, of maak een nieuwe back-up zolang de gegevens nog op je toestel staan.',
  'faq.privacy.delete.q': 'Hoe verwijder ik al mijn gegevens?',
  'faq.privacy.delete.a':
    '{settings} → {reset} verwijdert alle gegevens en profielen van het toestel. Als je de app verwijdert, verdwijnt ook de database. Back-upbestanden die je ergens anders hebt bewaard, moet je zelf verwijderen.',

  'faq.profiles.title': 'Profielen en instellingen',
  'faq.profiles.what.q': 'Wat zijn profielen?',
  'faq.profiles.what.a':
    'Gescheiden administraties in één app, bijvoorbeeld privé, zakelijk en huishouden. Elk profiel heeft zijn eigen transacties, categorieën, regels, budgetten en schulden, en een eigen naam, kleur en valuta. Een afschrift wordt geïmporteerd in het profiel dat actief is.',
  'faq.profiles.currency.q': 'Wat gebeurt er als ik de valuta wijzig?',
  'faq.profiles.currency.a':
    'De bedragen die al in het profiel staan, worden omgerekend met vaste koersen die in de app zijn ingebouwd, niet met actuele wisselkoersen. Het resultaat is dus een benadering.',
  'faq.profiles.languages.q': 'Welke valuta’s en talen zijn er?',
  'faq.profiles.languages.a':
    'Valuta’s: EUR, USD, GBP, JPY, CHF, CAD en AUD. Talen: Engels, Nederlands, Duits, Turks, Spaans, Frans, Italiaans, Portugees en Russisch.',
  'faq.profiles.notifications.q': 'Wanneer stuurt de app meldingen?',
  'faq.profiles.notifications.a':
    'Importherinneringen op de 15e en de 28e van elke maand, die vervallen zodra je een afschrift importeert, en de meldingen van {health} die je hebt aangezet. Ze worden allemaal op je toestel ingepland. De herinneringen zet je uit onder {settings} → {reminders}.',
};
