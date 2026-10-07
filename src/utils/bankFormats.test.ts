// Run with: npx tsx src/utils/bankFormats.test.ts
import type { BankId } from './bankFormats';
import { type ParsedStatement, type ParsedTransaction, parseCSVContent } from './parser';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const parse = (lines: string[]): ParsedStatement => parseCSVContent(lines.join('\n'));

const expectBank = (label: string, result: ParsedStatement, bank: BankId | null, rows: number): void => {
  check(`${label}: bank`, result.bank === bank, `got ${result.bank}`);
  check(`${label}: rows`, result.transactions.length === rows, `got ${result.transactions.length}`);
};

const expectRow = (label: string, tx: ParsedTransaction | undefined, expected: Partial<ParsedTransaction>): void => {
  for (const [key, value] of Object.entries(expected)) {
    const actual = tx?.[key as keyof ParsedTransaction];
    check(`${label}: ${key}`, actual === value, `got ${JSON.stringify(actual)}`);
  }
};

/** The bank map reads the same amount and text as the old header guess, so stored rows still match. */
const expectUnchanged = (label: string, result: ParsedStatement): void => {
  check(
    `${label}: same dedup key as before`,
    result.transactions.every((tx) => tx.previousKeys === undefined)
  );
};

// ING, Dutch, comma separated
{
  const result = parse([
    '"Datum","Naam / Omschrijving","Rekening","Tegenrekening","Code","Af Bij","Bedrag (EUR)","Mutatiesoort","Mededelingen","Saldo na mutatie","Tag"',
    '"20240131","Vattenfall Klantenservice","NL01INGB0001234567","NL02ABNA0123456789","IC","Af","85,50","Incasso","Naam: Vattenfall Klantenservice Omschrijving: Termijn januari IBAN: NL02ABNA0123456789","1.200,00",""',
    '"20240125","Werkgever BV","NL01INGB0001234567","NL03RABO0123456789","OV","Bij","2.500,00","Overschrijving","Salaris januari","1.285,50",""',
  ]);
  expectBank('ING nl', result, 'ING', 2);
  expectRow('ING nl debit', result.transactions[0], {
    date: '2024-01-31',
    amount: -85.5,
    merchant: 'Vattenfall',
    counterpartyIban: 'NL02ABNA0123456789',
    txType: 'DIRECT_DEBIT',
    dateAmbiguous: 0,
  });
  expectRow('ING nl credit', result.transactions[1], { amount: 2500, txType: 'TRANSFER' });
  expectUnchanged('ING nl', result);
}

// ING, English, semicolon separated
{
  const result = parse([
    'Date;Name / Description;Account;Counterparty;Code;Debit/credit;Amount (EUR);Transaction type;Notifications;Resulting balance;Tag',
    '20240203;Bakkerij Jansen;NL01INGB0001234567;;BA;Debit;4,20;Payment terminal;Card sequence no.: 001 03-02-2024 10:15;1.195,80;',
  ]);
  expectBank('ING en', result, 'ING', 1);
  expectRow('ING en', result.transactions[0], { date: '2024-02-03', amount: -4.2, txType: 'CARD' });
  expectUnchanged('ING en', result);
}

// ABN AMRO, headerless tab separated TXT
{
  const result = parse([
    '123456789\tEUR\t20240131\t1000,00\t914,50\t20240131\t-85,50\tSEPA Incasso algemeen doorlopend Incassant: NL00ZZZ Naam: Ziggo Services BV Machtiging: 123 Omschrijving: Factuur januari IBAN: NL04INGB0001234567',
    '123456789\tEUR\t20240125\t914,50\t3414,50\t20240125\t2500,00\t/TRTP/SEPA OVERBOEKING/IBAN/NL03RABO0123456789/BIC/RABONL2U/NAME/Werkgever BV/REMI/Salaris januari/EREF/NOTPROVIDED',
  ]);
  expectBank('ABN txt', result, 'ABN_AMRO', 2);
  expectRow('ABN txt debit', result.transactions[0], {
    date: '2024-01-31',
    amount: -85.5,
    merchant: 'Ziggo',
    txType: 'DIRECT_DEBIT',
  });
  expectRow('ABN txt credit', result.transactions[1], { date: '2024-01-25', amount: 2500 });
}

// ABN AMRO, headers (Excel export layout, English and Dutch)
{
  const english = parse([
    'accountNumber,mutationcode,transactiondate,valuedate,startsaldo,endsaldo,amount,description',
    '123456789,EUR,20240131,20240131,1000,914.5,-85.5,"BEA, Betaalpas Albert Heijn 1234,PAS123 NR:CT123456, 31.01.24/12:34 AMSTERDAM"',
  ]);
  expectBank('ABN xls', english, 'ABN_AMRO', 1);
  expectRow('ABN xls', english.transactions[0], { date: '2024-01-31', amount: -85.5, txType: 'CARD' });
  expectUnchanged('ABN xls', english);

  const dutch = parse([
    'Rekeningnummer,Muntsoort,Transactiedatum,Rentedatum,Beginsaldo,Eindsaldo,Transactiebedrag,Omschrijving',
    '123456789,EUR,20240131,20240131,"1000,00","914,50","-85,50",Huur januari',
  ]);
  expectBank('ABN nl', dutch, 'ABN_AMRO', 1);
  expectRow('ABN nl', dutch.transactions[0], { date: '2024-01-31', amount: -85.5 });
  expectUnchanged('ABN nl', dutch);
}

// Rabobank
{
  const result = parse([
    '"IBAN/BBAN","Munt","BIC","Volgnr","Datum","Rentedatum","Bedrag","Saldo na trn","Tegenrekening IBAN/BBAN","Naam tegenpartij","Naam uiteindelijke partij","Naam initiërende partij","BIC tegenpartij","Code","Batch ID","Transactiereferentie","Machtigingskenmerk","Incassant ID","Betalingskenmerk","Omschrijving-1","Omschrijving-2","Omschrijving-3","Reden retour","Oorspr bedrag","Oorspr munt","Koers"',
    '"NL05RABO0123456789","EUR","RABONL2U","000000000000001234","2024-01-31","2024-01-31","-45,00","+955,00","NL06INGB0007654321","KPN B.V.","","","INGBNL2A","ei","","","M123","NL00ZZZ","","Factuur 123","Mobiel abonnement","","","","",""',
    '"NL05RABO0123456789","EUR","RABONL2U","000000000000001235","2024-02-01","2024-02-01","+2500,00","+3455,00","NL03RABO0123456789","Werkgever BV","","","RABONL2U","cb","","","","","","Salaris","","","","","",""',
  ]);
  expectBank('Rabobank', result, 'RABOBANK', 2);
  expectRow('Rabobank debit', result.transactions[0], {
    date: '2024-01-31',
    amount: -45,
    merchant: 'KPN',
    counterpartyIban: 'NL06INGB0007654321',
    txType: 'DIRECT_DEBIT',
    rawDescription: 'KPN B.V. Factuur 123 Mobiel abonnement',
  });
  expectRow('Rabobank credit', result.transactions[1], { amount: 2500 });
  expectUnchanged('Rabobank', result);
}

// bunq
{
  const result = parse([
    '"Date";"Interest Date";"Amount";"Account";"Counterparty";"Name";"Description"',
    '"2024-01-31";"2024-01-31";"-12,50";"NL07BUNQ0123456789";"NL08INGB0001112223";"Sportschool Fit";"Contributie januari"',
  ]);
  expectBank('bunq', result, 'BUNQ', 1);
  expectRow('bunq', result.transactions[0], {
    date: '2024-01-31',
    amount: -12.5,
    merchant: 'Sportschool Fit',
    counterpartyIban: 'NL08INGB0001112223',
  });
  expectUnchanged('bunq', result);
}

// Revolut
{
  const result = parse([
    'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
    'CARD_PAYMENT,Current,2024-01-30 18:22:10,2024-01-31 09:00:00,Cafe Central,-10.00,0.00,EUR,COMPLETED,490.00',
    'ATM,Current,2024-02-01 11:00:00,2024-02-01 11:00:05,Cash withdrawal,-100.00,2.00,EUR,COMPLETED,388.00',
    'CARD_PAYMENT,Current,2024-02-02 12:00:00,,Hotel Deposit,-200.00,0.00,EUR,PENDING,188.00',
    'CARD_PAYMENT,Current,2024-02-02 13:00:00,,Online Shop,-30.00,0.00,EUR,REVERTED,388.00',
    'TOPUP,Current,2024-02-03 08:00:00,2024-02-03 08:00:01,Top-Up by *1234,300.00,0.00,EUR,COMPLETED,688.00',
  ]);
  expectBank('Revolut', result, 'REVOLUT', 3);
  expectRow('Revolut card', result.transactions[0], {
    date: '2024-01-30',
    amount: -10,
    merchant: 'Cafe Central',
    txType: 'CARD',
  });
  check('Revolut card: no fee, same dedup key', result.transactions[0]?.previousKeys === undefined);
  expectRow('Revolut fee', result.transactions[1], { amount: -102 });
  const feeKeys = result.transactions[1]?.previousKeys ?? [];
  check(
    'Revolut fee: key without the fee kept',
    feeKeys.some((key) => key.amount === -100 && key.rawDescription === 'Cash withdrawal' && key.date === '2024-02-01'),
    JSON.stringify(feeKeys)
  );
  expectRow('Revolut top-up', result.transactions[2], { amount: 300 });
}

// Wise, balance statement
{
  const result = parse([
    '"TransferWise ID",Date,Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount"',
    'CARD-123,03-04-2024,-12.50,EUR,"Card transaction of 12.50 EUR issued by Albert Heijn AMSTERDAM",,987.50,,,,,,,Albert Heijn,1234,Jan Jansen,,,0.00,',
    'TRANSFER-456,05-04-2024,-250.00,EUR,Sent money to Piet Pietersen,Huur,737.50,,,,Jan Jansen,Piet Pietersen,NL09INGB0001234567,,,,,,0.50,',
    'TRANSFER-789,06-04-2024,1000.00,EUR,Received money from Werkgever BV with reference Salaris,Salaris,1737.50,,,,Werkgever BV,Jan Jansen,,,,,,,0.00,',
    'CARD-124,07-04-2024,-8.00,EUR,"Card transaction of 8.00 EUR issued by Bakkerij Jansen",,1729.50,,,,,,,,1234,Jan Jansen,,,0.00,',
  ]);
  expectBank('Wise statement', result, 'WISE', 4);
  expectRow('Wise card', result.transactions[0], {
    date: '2024-04-03',
    amount: -12.5,
    merchant: 'Albert Heijn',
    dateAmbiguous: 0,
  });
  expectRow('Wise sent', result.transactions[1], {
    date: '2024-04-05',
    amount: -250,
    merchant: 'Piet Pietersen',
    dateAmbiguous: 0,
  });
  check(
    'Wise sent: payer is not in the text',
    !(result.transactions[1]?.rawDescription ?? 'Jan Jansen').includes('Jan Jansen'),
    result.transactions[1]?.rawDescription
  );
  check(
    'Wise sent: old key kept',
    (result.transactions[1]?.previousKeys ?? []).some((key) => key.rawDescription.includes('Jan Jansen')),
    JSON.stringify(result.transactions[1]?.previousKeys)
  );
  expectRow('Wise received', result.transactions[2], { amount: 1000, merchant: 'Werkgever BV' });
  expectRow('Wise card without merchant column', result.transactions[3], { merchant: 'Bakkerij Jansen' });
}

// Wise, transfer history
{
  const result = parse([
    'ID,Status,Direction,"Created on","Finished on","Source fee amount","Source fee currency","Target fee amount","Target fee currency","Source name","Source amount (after fees)","Source currency","Target name","Target amount (after fees)","Target currency","Exchange rate",Reference,Batch,"Created by"',
    '1001,COMPLETED,OUT,2024-04-05 10:00:00,2024-04-05 10:05:00,0.50,EUR,,,Jan Jansen,250.00,EUR,Piet Pietersen,250.00,EUR,1.0,Huur,,Jan Jansen',
    '1002,COMPLETED,IN,2024-04-06 09:00:00,2024-04-06 09:00:10,0.00,EUR,,,Werkgever BV,1000.00,EUR,Jan Jansen,1000.00,EUR,1.0,Salaris,,',
    '1003,CANCELLED,OUT,2024-04-07 09:00:00,,0.00,EUR,,,Jan Jansen,40.00,EUR,Iemand Anders,40.00,EUR,1.0,,,Jan Jansen',
    '1004,COMPLETED,NEUTRAL,2024-04-08 09:00:00,2024-04-08 09:00:01,0.40,EUR,,,Jan Jansen,100.00,EUR,Jan Jansen,108.00,USD,1.08,,,Jan Jansen',
  ]);
  expectBank('Wise history', result, 'WISE', 2);
  expectRow('Wise history out', result.transactions[0], {
    date: '2024-04-05',
    amount: -250.5,
    merchant: 'Piet Pietersen',
  });
  expectRow('Wise history in', result.transactions[1], { amount: 1000, merchant: 'Werkgever BV' });
}

// N26, current layout
{
  const result = parse([
    '"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"',
    '"2024-01-31","2024-01-31","Stadtwerke Berlin","DE89370400440532013000","Direct Debit","Abschlag Januar","Main Account","-60.00","","",""',
    '"2024-02-01","2024-02-01","Cafe Mitte","","MasterCard Payment","","Main Account","-4.50","-4.50","EUR","1"',
  ]);
  expectBank('N26', result, 'N26', 2);
  expectRow('N26 direct debit', result.transactions[0], {
    date: '2024-01-31',
    amount: -60,
    merchant: 'Stadtwerke Berlin',
    counterpartyIban: 'DE89370400440532013000',
    txType: 'DIRECT_DEBIT',
  });
  expectRow('N26 card', result.transactions[1], { amount: -4.5, merchant: 'Cafe Mitte', txType: 'CARD' });
  expectUnchanged('N26', result);
}

// N26, older layout: English and German
{
  const english = parse([
    '"Date","Payee","Account number","Transaction type","Payment reference","Category","Amount (EUR)","Amount (Foreign Currency)","Type Foreign Currency","Exchange Rate"',
    '"2024-01-31","Stadtwerke Berlin","DE89370400440532013000","Direct Debit","Abschlag Januar","Household & Utilities","-60.0","","",""',
  ]);
  expectBank('N26 old en', english, 'N26', 1);
  expectRow('N26 old en', english.transactions[0], {
    amount: -60,
    counterpartyIban: 'DE89370400440532013000',
  });
  expectUnchanged('N26 old en', english);

  const german = parse([
    '"Datum","Empfänger","Kontonummer","Transaktionstyp","Verwendungszweck","Kategorie","Betrag (EUR)","Betrag (Fremdwährung)","Fremdwährung","Wechselkurs"',
    '"2024-01-31","Stadtwerke Berlin","DE89370400440532013000","Lastschrift","Abschlag Januar","Haushalt & Nebenkosten","-60.0","","",""',
  ]);
  expectBank('N26 old de', german, 'N26', 1);
  expectRow('N26 old de', german.transactions[0], {
    date: '2024-01-31',
    amount: -60,
    merchant: 'Stadtwerke Berlin',
    counterpartyIban: 'DE89370400440532013000',
  });
}

// A preamble above the header row
{
  const result = parse([
    'Account statement',
    'Generated 2024-02-05',
    'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
    'CARD_PAYMENT,Current,2024-01-30 18:22:10,2024-01-31 09:00:00,Cafe Central,-10.00,0.00,EUR,COMPLETED,490.00',
  ]);
  expectBank('preamble', result, 'REVOLUT', 1);
}

// Unknown banks still go through the header guess
{
  const result = parse([
    'Transaction Date,Payee,Memo,Amount',
    '2024-01-31,Local Gym,Membership,-25.00',
  ]);
  expectBank('unknown bank', result, null, 1);
  expectRow('unknown bank', result.transactions[0], { date: '2024-01-31', amount: -25, merchant: 'Local Gym' });
  check('unknown bank: no previous keys', result.transactions[0]?.previousKeys === undefined);

  const ambiguous = parse(['Date,Description,Amount', '03-04-2024,Local Gym,-25.00']);
  expectRow('unknown bank day/month', ambiguous.transactions[0], { dateAmbiguous: 1 });

  const positional = parse(['2024-01-31,-25.00,Local Gym']);
  expectBank('no header', positional, null, 1);
}

console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) failed.`);
if (failures > 0) process.exit(1);
