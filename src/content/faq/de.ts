import type { FaqCopy } from './en';

export const de: FaqCopy = {
  'faq.title': 'Häufige Fragen',
  'faq.description':
    'Antworten zum Import von Kontoauszügen, zu Kategorien, Budget-Gesundheit, Datenschutz und Backups in Financial Aid.',
  'faq.intro': 'Kurze Antworten dazu, wie Financial Aid funktioniert. Tippe auf eine Frage, um die Antwort zu lesen.',

  'faq.start.title': 'Erste Schritte',
  'faq.start.what.q': 'Was macht Financial Aid?',
  'faq.start.what.a':
    'Die App liest die Kontoauszüge, die du bei deiner Bank herunterlädst, ordnet jede Transaktion einer Kategorie zu und zeigt, wohin dein Geld fließt: Einnahmen, Ausgaben, Budgets, Schulden und Trends. Importiere zum Start einen Kontoauszug über {settings} → {importRow}.',
  'faq.start.bank.q': 'Verbindet sich die App mit meiner Bank?',
  'faq.start.bank.a':
    'Nein. Du lädst selbst einen Kontoauszug bei deiner Bank herunter und importierst diese Datei. Die App fragt nie nach deinen Bankzugangsdaten und hat keine Verbindung zu deiner Bank.',
  'faq.start.statement.q': 'Wie bekomme ich einen Kontoauszug von meiner Bank?',
  'faq.start.statement.a':
    'Lade ihn in der App oder auf der Website deiner Bank als CSV- oder Excel-Datei herunter. {settings} → {guide} zeigt die Schritte pro Bank, übernommen von den Hilfeseiten der jeweiligen Bank, und allgemeine Schritte für jede andere Bank.',
  'faq.start.demo.q': 'Kann ich die App ohne meine eigenen Daten ausprobieren?',
  'faq.start.demo.a':
    'Ja. Der Willkommensbildschirm bietet {demo}: ein eigenes Profil mit drei Monaten Beispieltransaktionen und zwei Beispielschulden. Import, Backup, Zurücksetzen, Profilwechsel und Import-Erinnerungen sind dort ausgeschaltet. Du verlässt die Demo mit {exitDemo}.',

  'faq.import.title': 'Kontoauszüge importieren',
  'faq.import.files.q': 'Welche Dateien kann ich importieren?',
  'faq.import.files.a':
    'CSV-Dateien, Textdateien mit Tabulator oder Semikolon als Trennzeichen (.txt, .tsv) und Excel-Dateien (.xlsx, .xls). Fotos, Screenshots und Bankformate wie CAMT XML, MT940 und OFX werden abgelehnt, mit dem Hinweis, den CSV- oder Excel-Export zu nutzen.',
  'faq.import.banks.q': 'Welche Banken werden unterstützt?',
  'faq.import.banks.a':
    'Die Exporte von {banks} werden automatisch erkannt. Andere Banken funktionieren, wenn sie einen CSV- oder Excel-Download anbieten; die App erkennt die Spalten an der Kopfzeile.',
  'faq.import.pdf.q': 'Kann ich einen PDF-Kontoauszug importieren?',
  'faq.import.pdf.a':
    'Nur PDF-Kontoauszüge von ABN AMRO. Sie werden auf deinem Gerät gelesen, und jeder Auszug wird mit seinen eigenen aufgedruckten Summen und Salden abgeglichen; ein Auszug, der nicht aufgeht, wird nicht importiert. Nutze für gescannte PDFs und für andere Banken den CSV- oder Excel-Export.',
  'faq.import.twice.q': 'Was passiert, wenn ich denselben Kontoauszug zweimal importiere?',
  'faq.import.twice.a':
    'Transaktionen, die schon in der App sind, werden übersprungen. Überlappende Kontoauszüge zu importieren ist also unbedenklich.',
  'faq.import.share.q': 'Kann ich direkt aus meiner Banking-App importieren?',
  'faq.import.share.a':
    'Ja. Exportiere den Kontoauszug in deiner Banking-App, wähle Teilen und dann Financial Aid. Die Datei wird in das aktive Profil importiert, genauso wie eine Datei, die du selbst auswählst.',
  'faq.import.coverage.q': 'Woran erkenne ich, ob ein Monat vollständig ist?',
  'faq.import.coverage.a':
    'Der Auszugshinweis auf {home} zeigt, wie viel vom gewählten Monat deine Kontoauszüge abdecken: noch keine Daten, der laufende Monat, ein vergangener Monat mit fehlenden Tagen oder der ganze Monat. Ein vergangener Monat mit fehlenden Tagen steht außerdem unter {forYou}.',

  'faq.categories.title': 'Kategorien und Budgets',
  'faq.categories.how.q': 'Wie werden Transaktionen kategorisiert?',
  'faq.categories.how.a':
    'Beim Import, in dieser Reihenfolge: deine eigenen Regeln, was du früher für denselben Händler gewählt hast, dann eingebaute Stichwörter im Händlernamen und im übrigen Banktext. Passt nichts, wird eingehendes Geld zu {income} und Ausgaben werden zu {uncategorised}. Die eingebauten Stichwörter sind auf niederländische Banken und Händler abgestimmt.',
  'faq.categories.fix.q': 'Eine Transaktion ist in der falschen Kategorie. Wie korrigiere ich das?',
  'faq.categories.fix.a':
    'Öffne die Transaktion und tippe auf ihre Kategorie. Deine Wahl wird gemerkt und später nicht überschrieben. Sobald du einen Händler mindestens zweimal korrigiert hast, überwiegend gleich, folgen seine neuen Transaktionen deiner Wahl.',
  'faq.categories.review.q': 'Was mache ich mit Transaktionen ohne Kategorie?',
  'faq.categories.review.a':
    'Der Bildschirm {transactions} zeigt oben, wie viele es sind. Die Prüfliste gruppiert sie nach Händler, die größten zuerst, und schlägt wenn möglich eine Kategorie vor. Eine einmal gewählte Kategorie gilt für alle Transaktionen dieses Händlers und für künftige Importe.',
  'faq.categories.fixed.q': 'Was sind fixe und flexible Kosten?',
  'faq.categories.fixed.a':
    'Fixkosten sind wiederkehrende Rechnungen wie Miete, Nebenkosten und Abos; der Rest ist flexibel. Die App erkennt sie am Verhalten eines Händlers: ein regelmäßiger Rhythmus, stabile Beträge und Lastschriften. Im Detail einer Transaktion kannst du den Händler als {fixed} oder {flexible} markieren oder mit {resetAuto} zurückgehen.',
  'faq.categories.budget.q': 'Wie lege ich ein Budget fest?',
  'faq.categories.budget.a':
    'Öffne {settings} → {budgets} und lege pro Kategorie ein Monatslimit fest. Fortschrittsbalken auf {home} und auf dem Budget-Bildschirm zeigen, was du im Verhältnis zum Limit ausgegeben hast. Ein Limit lässt sich auch im Diagramm auf {trends} festlegen.',
  'faq.categories.own.q': 'Kann ich eigene Kategorien und Regeln hinzufügen?',
  'faq.categories.own.a':
    'Ja. Unter {settings} → {categories} erstellst du Kategorien, benennst sie um, änderst ihre Farbe, löschst sie und fügst ihnen Stichwortregeln hinzu. Ändert sich eine Regel, werden die Transaktionen, die du nicht von Hand kategorisiert hast, neu einsortiert.',

  'faq.plan.score.q': 'Wie wird der Gesundheitswert berechnet?',
  'faq.plan.score.a':
    'Der Wert reicht von 0 bis 100 und verbindet fünf Säulen: Sparquote (30%), Wohnen (20%), Fixkosten (15%), Schuldenzahlungen ohne die Hypothek (20%) und ein Sicherheitspolster (15%). Jede Säule wird mit einer gängigen Faustregel verglichen. Ein Polster, das du nicht eingetragen hast, bleibt außen vor; die anderen Säulen teilen sich sein Gewicht.',
  'faq.plan.income.q': 'Welches Einkommen verwendet der Gesundheitswert?',
  'faq.plan.income.a':
    'Den Durchschnitt der letzten drei vollständigen Monate mit Einnahmen in deinen Kontoauszügen oder den Betrag, den du selbst eingibst. Solange es keinen Monat mit Einnahmen gibt, wird kein Wert angezeigt.',
  'faq.plan.debts.q': 'Wie findet die App meine Schuldenzahlungen?',
  'faq.plan.debts.a':
    'Jede Schuld hat Stichwörter. Nach jedem Import wird eine Transaktion verknüpft, wenn ein Stichwort mit einem ganzen Wort übereinstimmt und der Betrag nahe an der Monatsrate liegt. Knappe Abweichungen stehen als mögliche Treffer in der Liste und lassen sich von Hand hinzufügen; eine verknüpfte Zahlung kannst du wieder lösen.',
  'faq.plan.growth.q': 'Was zeigt {growth}?',
  'faq.plan.growth.a':
    'Wie ein Startbetrag und ein monatlicher Beitrag über die Jahre wachsen könnten. Die drei Szenarien rechnen mit einer jährlichen Rendite von 5%, 7% und 9%; du kannst auch deine eigene Rendite, Gebühr und Inflation eingeben. Das Ergebnis ist eine Prognose, kein Versprechen.',
  'faq.plan.advice.q': 'Sind der Gesundheitswert oder der Wachstumsrechner eine Finanzberatung?',
  'faq.plan.advice.a':
    'Nein. Der Gesundheitswert vergleicht deine Ausgaben mit gängigen Faustregeln, und der Wachstumsrechner zeigt eine Prognose ohne Garantie. Beides ist keine Finanzberatung.',

  'faq.privacy.title': 'Datenschutz und Backups',
  'faq.privacy.where.q': 'Wo werden meine Daten gespeichert?',
  'faq.privacy.where.a':
    'In einer Datenbank auf deinem Gerät. Es gibt kein Konto und keinen Server, der deine Daten erhält, und die App enthält weder Analyse noch Werbung.',
  'faq.privacy.lost.q': 'Was, wenn ich mein Telefon verliere oder die App lösche?',
  'faq.privacy.lost.a':
    'Deine Daten gibt es nur auf deinem Gerät, ohne Backup lassen sie sich also nicht wiederherstellen. Erstelle regelmäßig ein Backup und bewahre es sicher auf; die App erinnert dich nach 30 Tagen daran.',
  'faq.privacy.backup.q': 'Wie erstelle ich ein Backup oder ziehe auf ein neues Telefon um?',
  'faq.privacy.backup.a':
    '{settings} → {backup} speichert eine Datei mit all deinen Profilen, und du entscheidest, wo sie liegt. Wähle auf dem neuen Telefon {restore} auf dem Willkommensbildschirm. Eine Wiederherstellung ersetzt alles auf dem Gerät, nichts wird zusammengeführt, und die App zeigt vorher, was sich ändert. {undo} bringt die ersetzten Daten zurück.',
  'faq.privacy.password.q': 'Ich habe das Passwort meines Backups vergessen. Lässt es sich zurücksetzen?',
  'faq.privacy.password.a':
    'Nein. Ein Backup mit Passwort ist verschlüsselt, und ohne das Passwort kann es niemand öffnen, auch wir nicht. Bewahre das Passwort sicher auf oder erstelle ein neues Backup, solange die Daten noch auf deinem Gerät sind.',
  'faq.privacy.delete.q': 'Wie lösche ich alle meine Daten?',
  'faq.privacy.delete.a':
    '{settings} → {reset} entfernt alle Daten und Profile vom Gerät. Wenn du die App löschst, wird auch ihre Datenbank entfernt. Backup-Dateien, die du woanders gespeichert hast, musst du selbst löschen.',

  'faq.profiles.title': 'Profile und Einstellungen',
  'faq.profiles.what.q': 'Was sind Profile?',
  'faq.profiles.what.a':
    'Getrennte Haushaltsbücher in einer App, zum Beispiel privat, geschäftlich und Haushalt. Jedes Profil hat seine eigenen Transaktionen, Kategorien, Regeln, Budgets und Schulden sowie einen eigenen Namen, eine eigene Farbe und Währung. Ein Kontoauszug wird in das Profil importiert, das gerade aktiv ist.',
  'faq.profiles.currency.q': 'Was passiert, wenn ich die Währung ändere?',
  'faq.profiles.currency.a':
    'Die Beträge, die schon im Profil gespeichert sind, werden mit festen, in die App eingebauten Kursen umgerechnet, nicht mit aktuellen Wechselkursen. Das Ergebnis ist also ein Näherungswert.',
  'faq.profiles.languages.q': 'Welche Währungen und Sprachen gibt es?',
  'faq.profiles.languages.a':
    'Währungen: EUR, USD, GBP, JPY, CHF, CAD und AUD. Sprachen: Englisch, Niederländisch, Deutsch, Türkisch, Spanisch, Französisch, Italienisch, Portugiesisch und Russisch.',
  'faq.profiles.notifications.q': 'Wann sendet die App Mitteilungen?',
  'faq.profiles.notifications.a':
    'Import-Erinnerungen am 15. und 28. jedes Monats, die entfallen, sobald du einen Kontoauszug importierst, und die Hinweise von {health}, die du eingeschaltet hast. Alle werden auf deinem Gerät geplant. Die Erinnerungen schaltest du unter {settings} → {reminders} aus.',
};
