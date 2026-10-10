import type { FaqCopy } from './en';

export const pt: FaqCopy = {
  'faq.title': 'Perguntas frequentes',
  'faq.description':
    'Respostas sobre importação de extratos, categorias, Saúde do orçamento, privacidade e backups no Financial Aid.',
  'faq.intro': 'Respostas curtas sobre como o Financial Aid funciona. Toque em uma pergunta para ler a resposta.',

  'faq.start.title': 'Primeiros passos',
  'faq.start.what.q': 'O que o Financial Aid faz?',
  'faq.start.what.a':
    'Ele lê os extratos que você baixa do seu banco, coloca cada transação em uma categoria e mostra para onde vai o seu dinheiro: receitas, gastos, orçamentos, dívidas e tendências. Para começar, importe um extrato em {settings} → {importRow}.',
  'faq.start.bank.q': 'O app se conecta ao meu banco?',
  'faq.start.bank.a':
    'Não. Você mesmo baixa um extrato do seu banco e importa esse arquivo. O app nunca pede a senha do banco e não tem nenhuma conexão com ele.',
  'faq.start.statement.q': 'Como consigo um extrato do meu banco?',
  'faq.start.statement.a':
    'Baixe-o no app ou no site do seu banco como arquivo CSV ou Excel. {settings} → {guide} mostra os passos de cada banco, tirados das páginas de ajuda do próprio banco, e passos gerais para qualquer outro banco.',
  'faq.start.demo.q': 'Posso experimentar o app sem os meus dados?',
  'faq.start.demo.a':
    'Sim. A tela de boas-vindas oferece {demo}: um perfil separado com três meses de transações de exemplo e duas dívidas de exemplo. Ali ficam desativados a importação, o backup, a redefinição, a troca de perfil e os lembretes de importação. O plano de Crescimento futuro não pode ser alterado ali. Para sair, use {exitDemo}.',

  'faq.import.title': 'Importar extratos',
  'faq.import.files.q': 'Quais arquivos posso importar?',
  'faq.import.files.a':
    'Arquivos CSV, arquivos de texto separados por tabulação ou ponto e vírgula (.txt, .tsv) e arquivos do Excel (.xlsx, .xls). Fotos, capturas de tela e formatos bancários como CAMT XML, MT940 e OFX são recusados, com a sugestão de usar a exportação em CSV ou Excel.',
  'faq.import.banks.q': 'Quais bancos são compatíveis?',
  'faq.import.banks.a':
    'As exportações de {banks} são reconhecidas automaticamente. Outros bancos funcionam quando oferecem download em CSV ou Excel; o app detecta as colunas pela linha de cabeçalho.',
  'faq.import.pdf.q': 'Posso importar um extrato em PDF?',
  'faq.import.pdf.a':
    'Somente extratos em PDF do ABN AMRO. Eles são lidos no seu aparelho, e cada um é conferido com os próprios totais e saldos impressos; um extrato cujas contas não fecham não é importado. Para PDFs digitalizados e para outros bancos, use a exportação em CSV ou Excel.',
  'faq.import.twice.q': 'O que acontece se eu importar o mesmo extrato duas vezes?',
  'faq.import.twice.a':
    'As transações que já estão no app são ignoradas, então importar extratos que se sobrepõem é seguro.',
  'faq.import.share.q': 'Posso importar direto do app do meu banco?',
  'faq.import.share.a':
    'Sim. Exporte o extrato no app do seu banco, escolha Compartilhar e selecione o Financial Aid. O arquivo é importado para o perfil ativo, do mesmo jeito que um arquivo escolhido por você.',
  'faq.import.coverage.q': 'Como sei se um mês está completo?',
  'faq.import.coverage.a':
    'A etiqueta de extrato em {home} mostra quanto do mês selecionado os seus extratos cobrem: ainda sem dados, o mês em andamento, um mês passado com dias faltando ou o mês inteiro. Um mês passado com dias faltando também aparece em {forYou}.',

  'faq.import.manual.q': 'Posso adicionar uma transação à mão?',
  'faq.import.manual.a':
    'Sim. Toque no + no meio da barra de abas e escolha despesa ou receita; depois digite um valor, uma descrição, uma data e uma categoria. Uma transação que você mesmo lançou pode ser apagada no detalhe dela. Se depois você importar um extrato com o mesmo pagamento, ele é adicionado pela segunda vez; apague então o seu lançamento.',
  'faq.categories.title': 'Categorias e orçamentos',
  'faq.categories.how.q': 'Como as transações são categorizadas?',
  'faq.categories.how.a':
    'Na importação, nesta ordem: as suas regras, o que você escolheu antes para o mesmo estabelecimento e depois as palavras-chave integradas no nome do estabelecimento e no restante do texto do banco. Se nada corresponder, o dinheiro que entra vira {income} e os gastos viram {uncategorised}. As palavras-chave integradas são ajustadas para bancos e estabelecimentos holandeses.',
  'faq.categories.fix.q': 'Uma transação está na categoria errada. Como corrijo?',
  'faq.categories.fix.a':
    'Abra a transação e toque na categoria. A sua escolha é lembrada e não é sobrescrita depois. Depois de corrigir um estabelecimento pelo menos duas vezes, quase sempre do mesmo jeito, as novas transações dele seguem a sua escolha.',
  'faq.categories.review.q': 'O que faço com as transações sem categoria?',
  'faq.categories.review.a':
    'A tela {transactions} mostra no topo quantas são. A lista de revisão as agrupa por estabelecimento, das maiores para as menores, e sugere uma categoria quando consegue. Escolher uma categoria uma vez vale para todas as transações daquele estabelecimento e para as próximas importações. Você também pode abrir uma categoria em {home}, {health}, {trends} ou {categories} e adicionar ali transações sem categoria: marque várias de uma vez; um estabelecimento selecionado por inteiro é lembrado nas próximas importações.',
  'faq.categories.fixed.q': 'O que são gastos fixos e flexíveis?',
  'faq.categories.fixed.a':
    'Gastos fixos são contas que se repetem, como aluguel, contas de consumo e assinaturas; o restante é flexível. O app os detecta pelo comportamento do estabelecimento: um ritmo regular, valores estáveis e débitos automáticos. No detalhe de uma transação, você pode marcar o estabelecimento como {fixed} ou {flexible}, ou voltar atrás com {resetAuto}.',
  'faq.categories.budget.q': 'Como defino um orçamento?',
  'faq.categories.budget.a':
    'Abra {settings} → {budgets} e defina um limite mensal por categoria. As barras de progresso em {home} e na tela de orçamentos mostram quanto você gastou em relação ao limite. O limite também pode ser definido pelo gráfico em {trends}.',
  'faq.categories.own.q': 'Posso adicionar as minhas próprias categorias e regras?',
  'faq.categories.own.a':
    'Sim. Em {settings} → {categories} você cria categorias, muda o nome ou a cor, exclui e adiciona regras de palavras-chave a elas. Quando uma regra muda, as transações que você não categorizou à mão são organizadas de novo.',

  'faq.plan.score.q': 'Como a pontuação de saúde é calculada?',
  'faq.plan.score.a':
    'A pontuação vai de 0 a 100 e reúne cinco pilares: taxa de poupança (30%), moradia (20%), gastos fixos (15%), pagamentos de dívidas sem o financiamento imobiliário (20%) e uma reserva de segurança (15%). Cada pilar é comparado com uma regra prática comum. Uma reserva que você não informou fica de fora, e os outros pilares dividem o peso dela.',
  'faq.plan.income.q': 'Qual renda a pontuação de saúde usa?',
  'faq.plan.income.a':
    'A média dos três últimos meses completos de receitas nos seus extratos, ou o valor que você mesmo digita. Enquanto não houver um mês com receitas, nenhuma pontuação é exibida. Um empréstimo recebido ou outro pagamento pontual de valor alto não conta como receita.',
  'faq.plan.debts.q': 'Como o app encontra os pagamentos das minhas dívidas?',
  'faq.plan.debts.a':
    'Cada dívida tem palavras-chave. Depois de cada importação, uma transação é vinculada quando uma palavra-chave corresponde a uma palavra inteira e o valor fica perto do pagamento mensal. Os casos que quase correspondem aparecem como possíveis correspondências para adicionar à mão, e um pagamento vinculado pode ser desvinculado. No formulário da dívida você também pode escolher um pagamento entre as suas transações: todos os pagamentos ao mesmo credor são selecionados junto, e a palavra-chave é adicionada para você.',
  'faq.plan.growth.q': 'O que {growth} mostra?',
  'faq.plan.growth.a':
    'Como um valor inicial e um aporte mensal poderiam crescer ao longo dos anos. Os três cenários usam um retorno anual de 5%, 7% e 9%; você também pode informar o seu próprio retorno, a taxa e a inflação. O resultado é uma projeção, não uma promessa.',
  'faq.plan.advice.q': 'A pontuação de saúde ou a calculadora de crescimento são aconselhamento financeiro?',
  'faq.plan.advice.a':
    'Não. A pontuação de saúde compara seus gastos com regras práticas comuns, e a calculadora de crescimento mostra uma projeção sem garantia. Nenhuma das duas é aconselhamento financeiro.',

  'faq.privacy.title': 'Privacidade e backups',
  'faq.privacy.where.q': 'Onde meus dados ficam guardados?',
  'faq.privacy.where.a':
    'Em um banco de dados no seu aparelho. Nenhum servidor recebe seus dados financeiros, e o app não contém análises nem anúncios.',
  'faq.privacy.account.q': 'Preciso de uma conta?',
  'faq.privacy.account.a':
    'Não. O app funciona sem conta. A conta só é necessária para uma compra no app, para que a compra continue com você em um celular novo. Ela guarda seu e-mail, um ID de conta e a data de criação; seus dados financeiros nunca saem do seu celular. Você pode excluir a conta em {settings} → {account}.',
  'faq.privacy.lost.q': 'E se eu perder o celular ou apagar o app?',
  'faq.privacy.lost.a':
    'Seus dados existem apenas no seu aparelho, então sem um backup eles não podem ser recuperados. Faça backup regularmente e guarde-o em um lugar seguro; o app lembra você depois de 30 dias.',
  'faq.privacy.backup.q': 'Como faço um backup ou mudo para um celular novo?',
  'faq.privacy.backup.a':
    '{settings} → {backup} salva um arquivo com todos os seus perfis, e você escolhe para onde ele vai. No celular novo, escolha {restore} na tela de boas-vindas. Uma restauração substitui tudo o que está no aparelho, nada é mesclado, e o app mostra antes o que vai mudar. {undo} traz de volta os dados substituídos.',
  'faq.privacy.password.q': 'Esqueci a senha do meu backup. Dá para redefinir?',
  'faq.privacy.password.a':
    'Não. Um backup com senha é criptografado, e sem a senha ninguém consegue abri-lo, nem nós. Guarde a senha em um lugar seguro, ou faça um novo backup enquanto os dados ainda estão no seu aparelho.',
  'faq.privacy.delete.q': 'Como apago todos os meus dados?',
  'faq.privacy.delete.a':
    '{settings} → {reset} remove todos os dados e perfis do aparelho. Apagar o app também remove o banco de dados dele. Os arquivos de backup que você salvou em outro lugar precisam ser apagados por você.',

  'faq.profiles.title': 'Perfis e ajustes',
  'faq.profiles.what.q': 'O que são perfis?',
  'faq.profiles.what.a':
    'Controles separados em um só app, por exemplo pessoal, negócio e casa. Cada perfil tem as próprias transações, categorias, regras, orçamentos e dívidas, além de nome, cor e moeda próprios. Um extrato é importado para o perfil que está ativo.',
  'faq.profiles.currency.q': 'O que acontece quando mudo a moeda?',
  'faq.profiles.currency.a':
    'O app baixa a taxa de câmbio do dia, mostra a taxa e, depois da sua confirmação, converte os valores já guardados no perfil (transações, orçamentos, dívidas e valores da casa). Os planos de Crescimento futuro não são convertidos. A solicitação não contém nenhum dos seus dados. Trocar a moeda exige conexão com a internet. Os valores convertidos são arredondados, então o resultado é aproximado.',
  'faq.profiles.languages.q': 'Quais moedas e idiomas estão disponíveis?',
  'faq.profiles.languages.a':
    'Moedas: mais de 150, entre elas EUR, USD, GBP, JPY, CHF, CAD e AUD. Idiomas: inglês, holandês, alemão, turco, espanhol, francês, italiano, português e russo.',
  'faq.profiles.notifications.q': 'Quando o app envia notificações?',
  'faq.profiles.notifications.a':
    'Lembretes de importação nos dias 15 e 28 de cada mês, cancelados quando você importa um extrato, e os alertas de {health} que você ativou. Todos são agendados no seu aparelho. Os lembretes são desativados em {settings} → {reminders}.',
};
