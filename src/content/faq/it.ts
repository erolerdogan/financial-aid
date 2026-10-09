import type { FaqCopy } from './en';

export const it: FaqCopy = {
  'faq.title': 'Domande frequenti',
  'faq.description':
    'Risposte su importazione degli estratti conto, categorie, Salute del budget, privacy e backup in Financial Aid.',
  'faq.intro': 'Risposte brevi su come funziona Financial Aid. Tocca una domanda per leggere la risposta.',

  'faq.start.title': 'Per iniziare',
  'faq.start.what.q': 'Che cosa fa Financial Aid?',
  'faq.start.what.a':
    'Legge gli estratti conto che scarichi dalla tua banca, mette ogni transazione in una categoria e mostra dove vanno i tuoi soldi: entrate, spese, budget, debiti e tendenze. Per cominciare, importa un estratto conto da {settings} → {importRow}.',
  'faq.start.bank.q': 'L’app si collega alla mia banca?',
  'faq.start.bank.a':
    'No. Scarichi tu un estratto conto dalla tua banca e importi quel file. L’app non chiede mai le credenziali della banca e non ha alcun collegamento con essa.',
  'faq.start.statement.q': 'Come ottengo un estratto conto dalla mia banca?',
  'faq.start.statement.a':
    'Scaricalo dall’app o dal sito della tua banca come file CSV o Excel. {settings} → {guide} mostra i passaggi per ogni banca, presi dalle pagine di assistenza della banca stessa, e passaggi generali per qualsiasi altra banca.',
  'faq.start.demo.q': 'Posso provare l’app senza i miei dati?',
  'faq.start.demo.a':
    'Sì. La schermata di benvenuto offre {demo}: un profilo separato con tre mesi di transazioni di esempio e due debiti di esempio. Lì importazione, backup, ripristino dei dati, cambio di profilo e promemoria di importazione sono disattivati. Il piano di Crescita futura lì non può essere modificato. Si esce con {exitDemo}.',

  'faq.import.title': 'Importare gli estratti conto',
  'faq.import.files.q': 'Quali file posso importare?',
  'faq.import.files.a':
    'File CSV, file di testo separati da tabulazioni o punti e virgola (.txt, .tsv) e file Excel (.xlsx, .xls). Foto, screenshot e formati bancari come CAMT XML, MT940 e OFX vengono rifiutati, con il suggerimento di usare l’esportazione in CSV o Excel.',
  'faq.import.banks.q': 'Quali banche sono supportate?',
  'faq.import.banks.a':
    'Le esportazioni di {banks} vengono riconosciute automaticamente. Le altre banche funzionano se offrono un download in CSV o Excel; l’app rileva le colonne dalla riga di intestazione.',
  'faq.import.pdf.q': 'Posso importare un estratto conto in PDF?',
  'faq.import.pdf.a':
    'Solo gli estratti conto in PDF di ABN AMRO. Vengono letti sul tuo dispositivo e ognuno viene verificato con i propri totali e saldi stampati; un estratto conto i cui conti non tornano non viene importato. Per i PDF scansionati e per le altre banche, usa l’esportazione in CSV o Excel.',
  'faq.import.twice.q': 'Che cosa succede se importo due volte lo stesso estratto conto?',
  'faq.import.twice.a':
    'Le transazioni già presenti nell’app vengono saltate, quindi importare estratti conto che si sovrappongono è sicuro.',
  'faq.import.share.q': 'Posso importare direttamente dall’app della mia banca?',
  'faq.import.share.a':
    'Sì. Esporta l’estratto conto nell’app della tua banca, scegli Condividi e seleziona Financial Aid. Il file viene importato nel profilo attivo, come un file che scegli tu.',
  'faq.import.coverage.q': 'Come faccio a sapere se un mese è completo?',
  'faq.import.coverage.a':
    'L’etichetta dell’estratto conto in {home} mostra quanta parte del mese selezionato è coperta dai tuoi estratti conto: ancora nessun dato, il mese in corso, un mese passato a cui mancano dei giorni oppure il mese intero. Un mese passato a cui mancano dei giorni compare anche in {forYou}.',

  'faq.categories.title': 'Categorie e budget',
  'faq.categories.how.q': 'Come vengono categorizzate le transazioni?',
  'faq.categories.how.a':
    'All’importazione, in quest’ordine: le tue regole, ciò che hai scelto in passato per lo stesso esercente, poi le parole chiave integrate nel nome dell’esercente e nel resto del testo della banca. Se non corrisponde nulla, il denaro in entrata diventa {income} e le spese diventano {uncategorised}. Le parole chiave integrate sono tarate su banche ed esercenti olandesi.',
  'faq.categories.fix.q': 'Una transazione è nella categoria sbagliata. Come la correggo?',
  'faq.categories.fix.a':
    'Apri la transazione e tocca la sua categoria. La tua scelta viene ricordata e non viene sovrascritta in seguito. Dopo aver corretto un esercente almeno due volte, quasi sempre allo stesso modo, le sue nuove transazioni seguono la tua scelta.',
  'faq.categories.review.q': 'Che cosa faccio con le transazioni senza categoria?',
  'faq.categories.review.a':
    'La schermata {transactions} mostra in alto quante sono. L’elenco di revisione le raggruppa per esercente, dalle più grandi, e suggerisce una categoria quando può. Scegliere una categoria una volta la applica a tutte le transazioni di quell’esercente e alle importazioni future.',
  'faq.categories.fixed.q': 'Che cosa sono le spese fisse e flessibili?',
  'faq.categories.fixed.a':
    'Le spese fisse sono le bollette che si ripetono, come affitto, utenze e abbonamenti; il resto è flessibile. L’app le riconosce dal comportamento dell’esercente: un ritmo regolare, importi stabili e addebiti diretti. Nel dettaglio di una transazione puoi segnare l’esercente come {fixed} o {flexible}, oppure tornare indietro con {resetAuto}.',
  'faq.categories.budget.q': 'Come imposto un budget?',
  'faq.categories.budget.a':
    'Apri {settings} → {budgets} e imposta un limite mensile per categoria. Le barre di avanzamento in {home} e nella schermata dei budget mostrano quanto hai speso rispetto al limite. Un limite si può impostare anche dal grafico in {trends}.',
  'faq.categories.own.q': 'Posso aggiungere categorie e regole mie?',
  'faq.categories.own.a':
    'Sì. In {settings} → {categories} crei le categorie, le rinomini, ne cambi il colore, le elimini e aggiungi regole con parole chiave. Quando una regola cambia, le transazioni che non hai categorizzato a mano vengono ordinate di nuovo.',

  'faq.plan.score.q': 'Come viene calcolato il punteggio di salute?',
  'faq.plan.score.a':
    'Il punteggio va da 0 a 100 e unisce cinque pilastri: tasso di risparmio (30%), casa (20%), spese fisse (15%), rate dei debiti senza il mutuo (20%) e un cuscinetto di sicurezza (15%). Ogni pilastro viene confrontato con una regola pratica comune. Un cuscinetto che non hai inserito viene escluso e gli altri pilastri se ne dividono il peso.',
  'faq.plan.income.q': 'Quale reddito usa il punteggio di salute?',
  'faq.plan.income.a':
    'La media degli ultimi tre mesi completi di entrate nei tuoi estratti conto, oppure l’importo che inserisci tu. Finché non c’è un mese con entrate, non viene mostrato alcun punteggio.',
  'faq.plan.debts.q': 'Come trova l’app i pagamenti dei miei debiti?',
  'faq.plan.debts.a':
    'Ogni debito ha delle parole chiave. Dopo ogni importazione, una transazione viene collegata quando una parola chiave corrisponde a una parola intera e l’importo è vicino alla rata mensile. I casi quasi corrispondenti sono elencati come possibili corrispondenze da aggiungere a mano, e un pagamento collegato si può scollegare.',
  'faq.plan.growth.q': 'Che cosa mostra {growth}?',
  'faq.plan.growth.a':
    'Come potrebbero crescere negli anni un importo iniziale e un versamento mensile. I tre scenari usano un rendimento annuo del 5%, 7% e 9%; puoi anche inserire il tuo rendimento, i costi e l’inflazione. Il risultato è una proiezione, non una promessa.',
  'faq.plan.advice.q': 'Il punteggio di salute o il calcolatore di crescita sono una consulenza finanziaria?',
  'faq.plan.advice.a':
    'No. Il punteggio di salute confronta le tue spese con regole pratiche comuni, e il calcolatore di crescita mostra una proiezione non garantita. Nessuno dei due è una consulenza finanziaria.',

  'faq.privacy.title': 'Privacy e backup',
  'faq.privacy.where.q': 'Dove vengono conservati i miei dati?',
  'faq.privacy.where.a':
    'In un database sul tuo dispositivo. Non c’è nessun account e nessun server che riceve i tuoi dati, e l’app non contiene analisi né pubblicità.',
  'faq.privacy.lost.q': 'E se perdo il telefono o elimino l’app?',
  'faq.privacy.lost.a':
    'I tuoi dati esistono solo sul tuo dispositivo, quindi senza un backup non possono essere recuperati. Fai un backup regolarmente e conservalo in un posto sicuro; l’app te lo ricorda dopo 30 giorni.',
  'faq.privacy.backup.q': 'Come faccio un backup o passo a un nuovo telefono?',
  'faq.privacy.backup.a':
    '{settings} → {backup} salva un file con tutti i tuoi profili, e scegli tu dove metterlo. Sul nuovo telefono scegli {restore} nella schermata di benvenuto. Un ripristino sostituisce tutto ciò che c’è sul dispositivo, non viene unito nulla, e l’app mostra prima che cosa cambierà. {undo} riporta indietro i dati sostituiti.',
  'faq.privacy.password.q': 'Ho dimenticato la password del mio backup. Si può reimpostare?',
  'faq.privacy.password.a':
    'No. Un backup con password è cifrato e senza la password nessuno può aprirlo, nemmeno noi. Conserva la password in un posto sicuro, oppure fai un nuovo backup finché i dati sono ancora sul tuo dispositivo.',
  'faq.privacy.delete.q': 'Come elimino tutti i miei dati?',
  'faq.privacy.delete.a':
    '{settings} → {reset} rimuove tutti i dati e i profili dal dispositivo. Eliminando l’app viene rimosso anche il suo database. I file di backup che hai salvato altrove devi eliminarli tu.',

  'faq.profiles.title': 'Profili e impostazioni',
  'faq.profiles.what.q': 'Che cosa sono i profili?',
  'faq.profiles.what.a':
    'Contabilità separate in un’unica app, per esempio personale, lavoro e famiglia. Ogni profilo ha le proprie transazioni, categorie, regole, budget e debiti, e un proprio nome, colore e valuta. Un estratto conto viene importato nel profilo attivo.',
  'faq.profiles.currency.q': 'Che cosa succede quando cambio valuta?',
  'faq.profiles.currency.a':
    'Gli importi già salvati nel profilo vengono convertiti con tassi fissi integrati nell’app, non con i tassi di cambio del momento, quindi il risultato è approssimativo.',
  'faq.profiles.languages.q': 'Quali valute e lingue sono disponibili?',
  'faq.profiles.languages.a':
    'Valute: EUR, USD, GBP, JPY, CHF, CAD e AUD. Lingue: inglese, olandese, tedesco, turco, spagnolo, francese, italiano, portoghese e russo.',
  'faq.profiles.notifications.q': 'Quando invia notifiche l’app?',
  'faq.profiles.notifications.a':
    'Promemoria di importazione il 15 e il 28 di ogni mese, annullati quando importi un estratto conto, e gli avvisi di {health} che hai attivato. Sono tutti programmati sul tuo dispositivo. I promemoria si disattivano in {settings} → {reminders}.',
};
