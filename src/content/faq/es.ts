import type { FaqCopy } from './en';

export const es: FaqCopy = {
  'faq.title': 'Preguntas frecuentes',
  'faq.description':
    'Respuestas sobre la importación de extractos, las categorías, la Salud del presupuesto, la privacidad y las copias de seguridad en Financial Aid.',
  'faq.intro': 'Respuestas breves sobre cómo funciona Financial Aid. Toca una pregunta para leer su respuesta.',

  'faq.start.title': 'Primeros pasos',
  'faq.start.what.q': '¿Qué hace Financial Aid?',
  'faq.start.what.a':
    'Lee los extractos que descargas de tu banco, pone cada transacción en una categoría y muestra adónde va tu dinero: ingresos, gastos, presupuestos, deudas y tendencias. Para empezar, importa un extracto desde {settings} → {importRow}.',
  'faq.start.bank.q': '¿La app se conecta a mi banco?',
  'faq.start.bank.a':
    'No. Tú descargas un extracto de tu banco e importas ese archivo. La app nunca te pide tus claves del banco y no tiene ninguna conexión con él.',
  'faq.start.statement.q': '¿Cómo consigo un extracto de mi banco?',
  'faq.start.statement.a':
    'Descárgalo en la app o en la web de tu banco como archivo CSV o Excel. {settings} → {guide} muestra los pasos de cada banco, tomados de las páginas de ayuda del propio banco, y pasos generales para cualquier otro banco.',
  'faq.start.demo.q': '¿Puedo probar la app sin mis propios datos?',
  'faq.start.demo.a':
    'Sí. La pantalla de bienvenida ofrece {demo}: un perfil aparte con tres meses de transacciones de ejemplo y dos deudas de ejemplo. Allí están desactivados la importación, la copia de seguridad, el restablecimiento, el cambio de perfil y los recordatorios de importación. El plan de Crecimiento futuro no se puede cambiar allí. Se sale con {exitDemo}.',

  'faq.import.title': 'Importar extractos',
  'faq.import.files.q': '¿Qué archivos puedo importar?',
  'faq.import.files.a':
    'Archivos CSV, archivos de texto separados por tabuladores o punto y coma (.txt, .tsv) y archivos de Excel (.xlsx, .xls). Las fotos, las capturas de pantalla y los formatos bancarios como CAMT XML, MT940 y OFX se rechazan, con la sugerencia de usar la exportación en CSV o Excel.',
  'faq.import.banks.q': '¿Qué bancos son compatibles?',
  'faq.import.banks.a':
    'Las exportaciones de {banks} se reconocen automáticamente. Otros bancos funcionan si ofrecen una descarga en CSV o Excel; la app detecta las columnas a partir de la fila de encabezado.',
  'faq.import.pdf.q': '¿Puedo importar un extracto en PDF?',
  'faq.import.pdf.a':
    'Solo los extractos en PDF de ABN AMRO. Se leen en tu dispositivo y cada uno se comprueba con sus propios totales y saldos impresos; un extracto que no cuadra no se importa. Para los PDF escaneados y para otros bancos, usa la exportación en CSV o Excel.',
  'faq.import.twice.q': '¿Qué pasa si importo el mismo extracto dos veces?',
  'faq.import.twice.a':
    'Las transacciones que ya están en la app se omiten, así que importar extractos que se solapan es seguro.',
  'faq.import.share.q': '¿Puedo importar directamente desde la app de mi banco?',
  'faq.import.share.a':
    'Sí. Exporta el extracto en la app de tu banco, elige Compartir y selecciona Financial Aid. El archivo se importa en el perfil activo, igual que un archivo que eliges tú.',
  'faq.import.coverage.q': '¿Cómo sé si un mes está completo?',
  'faq.import.coverage.a':
    'La etiqueta de extracto en {home} muestra qué parte del mes seleccionado cubren tus extractos: todavía sin datos, el mes en curso, un mes pasado al que le faltan días o el mes entero. Un mes pasado al que le faltan días aparece también en {forYou}.',

  'faq.import.manual.q': '¿Puedo añadir una transacción a mano?',
  'faq.import.manual.a':
    'Sí. Toca el + en el centro de la barra de pestañas y elige gasto o ingreso; después introduce un importe, una descripción, una fecha y una categoría. Una transacción que has introducido tú se puede eliminar desde su detalle. Si más adelante importas un extracto que contiene el mismo pago, se añade por segunda vez; elimina entonces tu propia entrada.',
  'faq.categories.title': 'Categorías y presupuestos',
  'faq.categories.how.q': '¿Cómo se categorizan las transacciones?',
  'faq.categories.how.a':
    'Al importar, en este orden: tus propias reglas, lo que elegiste antes para el mismo comercio y después las palabras clave integradas en el nombre del comercio y en el resto del texto del banco. Si nada coincide, el dinero que entra pasa a {income} y el gasto pasa a {uncategorised}. Las palabras clave integradas están ajustadas a bancos y comercios neerlandeses.',
  'faq.categories.fix.q': 'Una transacción está en la categoría equivocada. ¿Cómo la corrijo?',
  'faq.categories.fix.a':
    'Abre la transacción y toca su categoría. Tu elección se recuerda y no se sobrescribe después. Cuando hayas corregido un comercio al menos dos veces, casi siempre de la misma forma, sus nuevas transacciones seguirán tu elección.',
  'faq.categories.review.q': '¿Qué hago con las transacciones sin categoría?',
  'faq.categories.review.a':
    'La pantalla {transactions} muestra arriba cuántas hay. La lista de revisión las agrupa por comercio, de mayor a menor, y sugiere una categoría cuando puede. Elegir una categoría una vez la aplica a todas las transacciones de ese comercio y a las importaciones futuras. También puedes abrir una categoría en {home}, en {health}, en {trends} o en {categories} y añadirle allí transacciones sin categoría: marca varias a la vez; un comercio seleccionado por completo se recuerda para las importaciones futuras.',
  'faq.categories.fixed.q': '¿Qué son los gastos fijos y los flexibles?',
  'faq.categories.fixed.a':
    'Los gastos fijos son facturas que se repiten, como el alquiler, los suministros y las suscripciones; el resto es flexible. La app los detecta por el comportamiento del comercio: un ritmo regular, importes estables y domiciliaciones. En el detalle de una transacción puedes marcar su comercio como {fixed} o {flexible}, o volver atrás con {resetAuto}.',
  'faq.categories.budget.q': '¿Cómo establezco un presupuesto?',
  'faq.categories.budget.a':
    'Abre {settings} → {budgets} y fija un límite mensual por categoría. Las barras de progreso en {home} y en la pantalla de presupuestos muestran lo gastado frente al límite. El límite también se puede fijar desde el gráfico de {trends}.',
  'faq.categories.own.q': '¿Puedo añadir mis propias categorías y reglas?',
  'faq.categories.own.a':
    'Sí. En {settings} → {categories} creas categorías, les cambias el nombre o el color, las eliminas y les añades reglas de palabras clave. Cuando cambia una regla, las transacciones que no has categorizado a mano se vuelven a ordenar.',

  'faq.plan.score.q': '¿Cómo se calcula la puntuación de salud?',
  'faq.plan.score.a':
    'La puntuación va de 0 a 100 y combina cinco pilares: tasa de ahorro (30%), vivienda (20%), gastos fijos (15%), pagos de deudas sin la hipoteca (20%) y un colchón de seguridad (15%). Cada pilar se compara con una regla general habitual. Un colchón que no has introducido se deja fuera y los demás pilares se reparten su peso.',
  'faq.plan.income.q': '¿Qué ingresos usa la puntuación de salud?',
  'faq.plan.income.a':
    'La media de los tres últimos meses completos con ingresos en tus extractos, o el importe que escribes tú. Mientras no haya un mes con ingresos, no se muestra ninguna puntuación. Un préstamo recibido u otro pago único grande no cuenta como ingreso.',
  'faq.plan.debts.q': '¿Cómo encuentra la app los pagos de mis deudas?',
  'faq.plan.debts.a':
    'Cada deuda tiene palabras clave. Después de cada importación, una transacción se vincula cuando una palabra clave coincide con una palabra entera y el importe se acerca al pago mensual. Las que casi coinciden aparecen como posibles coincidencias que puedes añadir a mano, y un pago vinculado se puede desvincular. En el formulario de la deuda también puedes elegir un pago entre tus movimientos: todos los pagos al mismo prestamista se seleccionan con él y su palabra clave se añade por ti.',
  'faq.plan.growth.q': '¿Qué muestra {growth}?',
  'faq.plan.growth.a':
    'Cómo podrían crecer con los años un importe inicial y una aportación mensual. Los tres escenarios usan una rentabilidad anual del 5%, 7% y 9%; también puedes introducir tu propia rentabilidad, comisión e inflación. El resultado es una proyección, no una promesa.',
  'faq.plan.advice.q': '¿La puntuación de salud o la calculadora de crecimiento son asesoramiento financiero?',
  'faq.plan.advice.a':
    'No. La puntuación de salud compara tus gastos con reglas generales habituales, y la calculadora de crecimiento muestra una proyección que no está garantizada. Ninguna de las dos es asesoramiento financiero.',

  'faq.privacy.title': 'Privacidad y copias de seguridad',
  'faq.privacy.where.q': '¿Dónde se guardan mis datos?',
  'faq.privacy.where.a':
    'En una base de datos en tu dispositivo. Ningún servidor recibe tus datos financieros, y la app no contiene analíticas ni anuncios.',
  'faq.privacy.account.q': '¿Necesito una cuenta?',
  'faq.privacy.account.a':
    'No. La app funciona sin cuenta. La cuenta solo hace falta para una compra dentro de la app, así conservas la compra en un teléfono nuevo. Guarda tu correo electrónico, un identificador de cuenta y la fecha en que se creó; tus datos financieros nunca salen de tu teléfono. Puedes eliminar la cuenta en {settings} → {account}.',
  'faq.privacy.lost.q': '¿Y si pierdo el teléfono o elimino la app?',
  'faq.privacy.lost.a':
    'Tus datos solo existen en tu dispositivo, así que sin una copia de seguridad no se pueden recuperar. Haz una copia con regularidad y guárdala en un lugar seguro; la app te lo recuerda a los 30 días.',
  'faq.privacy.backup.q': '¿Cómo hago una copia de seguridad o paso a un teléfono nuevo?',
  'faq.privacy.backup.a':
    '{settings} → {backup} guarda un archivo con todos tus perfiles, y tú eliges dónde queda. En el teléfono nuevo, elige {restore} en la pantalla de bienvenida. Restaurar sustituye todo lo que hay en el dispositivo, no se fusiona nada, y la app muestra antes qué va a cambiar. {undo} recupera los datos sustituidos.',
  'faq.privacy.password.q': 'He olvidado la contraseña de mi copia de seguridad. ¿Se puede restablecer?',
  'faq.privacy.password.a':
    'No. Una copia con contraseña está cifrada y sin la contraseña nadie puede abrirla, ni siquiera nosotros. Guarda la contraseña en un lugar seguro, o haz una copia nueva mientras los datos sigan en tu dispositivo.',
  'faq.privacy.delete.q': '¿Cómo elimino todos mis datos?',
  'faq.privacy.delete.a':
    '{settings} → {reset} elimina todos los datos y perfiles del dispositivo. Al eliminar la app también se borra su base de datos. Las copias de seguridad que guardaste en otro sitio tienes que eliminarlas tú.',

  'faq.profiles.title': 'Perfiles y ajustes',
  'faq.profiles.what.q': '¿Qué son los perfiles?',
  'faq.profiles.what.a':
    'Libros de cuentas separados en una sola app, por ejemplo personal, negocio y hogar. Cada perfil tiene sus propias transacciones, categorías, reglas, presupuestos y deudas, y su propio nombre, color y moneda. Un extracto se importa en el perfil que está activo.',
  'faq.profiles.currency.q': '¿Qué pasa cuando cambio la moneda?',
  'faq.profiles.currency.a':
    'La app descarga el tipo de cambio del día, te lo muestra y, cuando confirmas, convierte los importes ya guardados en el perfil (movimientos, presupuestos, deudas e importes del hogar). Los planes de Crecimiento futuro no se convierten. La solicitud no contiene ninguno de tus datos. Para cambiar la moneda hace falta conexión a internet. Los importes convertidos se redondean, así que el resultado es aproximado.',
  'faq.profiles.languages.q': '¿Qué monedas e idiomas hay disponibles?',
  'faq.profiles.languages.a':
    'Monedas: más de 150, entre ellas EUR, USD, GBP, JPY, CHF, CAD y AUD. Idiomas: inglés, neerlandés, alemán, turco, español, francés, italiano, portugués y ruso.',
  'faq.profiles.notifications.q': '¿Cuándo envía notificaciones la app?',
  'faq.profiles.notifications.a':
    'Recordatorios de importación los días 15 y 28 de cada mes, que se cancelan cuando importas un extracto, y las alertas de {health} que hayas activado. Todas se programan en tu dispositivo. Los recordatorios se desactivan en {settings} → {reminders}.',
};
