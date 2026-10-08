// The bank export guides: one page per bank, general steps for any other bank, and the list of banks.
import {
  BANK_GUIDES,
  CHANNEL_KEYS,
  GENERIC_STEPS,
  guideName,
  labelLanguage,
  languageName,
  stepParts,
  type BankGuide,
  type GuideStep,
} from '../../../src/content/bankGuides';
import { createFormatters } from '../../../src/i18n/format';
import { PATHS, escapeHtml, href, htmlLang, pagePath, type Page, type SiteContext } from '../html';

const OTHER_SLUG = 'other-bank';

export const guidePath = (slug: string): string => `${PATHS.guides}${slug}/`;

const stepHtml = (step: GuideStep, guide: BankGuide | null, ctx: SiteContext): string =>
  stepParts(step, guide, ctx.code, ctx.t)
    .map((part) => (part.label ? `<strong>${escapeHtml(part.text)}</strong>` : escapeHtml(part.text)))
    .join('');

const stepText = (step: GuideStep, guide: BankGuide | null, ctx: SiteContext): string =>
  stepParts(step, guide, ctx.code, ctx.t)
    .map((part) => part.text)
    .join('');

function guidePage(ctx: SiteContext, guide: BankGuide | null): Page {
  const { code, tag, t } = ctx;
  const bank = guide ? guideName(guide) : t('guide.otherBankTitle');
  const steps = guide ? guide.steps : GENERIC_STEPS;
  const title = guide ? t('site.guideTitle', { bank, format: guide.format }) : t('site.indexTitle');
  const description = guide
    ? t('site.guideDescription', { bank, format: guide.format })
    : `${t('guide.otherBankSub')}. ${t('guide.generic.step3')}`;
  const heading = guide ? title : `${title}: ${bank}`;
  const menuLanguage = guide ? labelLanguage(guide, code) : code;

  const pills = guide
    ? `<ul class="pills"><li>${escapeHtml(t(CHANNEL_KEYS[guide.channel]))}</li><li>${escapeHtml(
        t('guide.fileType', { format: guide.format })
      )}</li></ul>`
    : '';
  const notes = [guide?.note ? t(guide.note) : null, t('guide.shareTip')]
    .filter((note): note is string => note !== null)
    .map((note) => `<p class="muted">${escapeHtml(note)}</p>`)
    .join('\n');
  const footnotes = guide
    ? [
        menuLanguage !== code ? t('guide.labelsNote', { language: languageName(menuLanguage) }) : null,
        t('guide.checked', { bank, date: createFormatters(tag).monthYear(guide.verified) }),
      ]
        .filter((note): note is string => note !== null)
        .map(escapeHtml)
        .join(' ') +
      ` <a href="${escapeHtml(guide.sourceUrl)}" rel="nofollow noopener">${escapeHtml(t('site.source', { bank }))}</a>`
    : '';

  const body = `<p class="small"><a href="${href(pagePath(code, PATHS.guides))}">← ${escapeHtml(t('guide.allBanks'))}</a></p>
<h1>${escapeHtml(heading)}</h1>
${pills}
<section class="card">
<ol class="steps">
${steps.map((step) => `<li><span>${stepHtml(step, guide, ctx)}</span></li>`).join('\n')}
</ol>
</section>
${notes}
${footnotes ? `<p class="small muted">${footnotes}</p>` : ''}
<p class="muted">${escapeHtml(t('site.intro'))}</p>`;

  return {
    path: guidePath(guide ? guide.slug : OTHER_SLUG),
    title: heading,
    description,
    body,
    article: true,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: heading,
      description,
      inLanguage: htmlLang(code),
      step: steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        text: stepText(step, guide, ctx),
      })),
    },
  };
}

function indexPage(ctx: SiteContext): Page {
  const { code, t } = ctx;
  const banks = BANK_GUIDES.map(guideName).join(', ');
  const rows = BANK_GUIDES.map(
    (guide) =>
      `<li><a href="${href(pagePath(code, guidePath(guide.slug)))}">${escapeHtml(guideName(guide))}<span>${escapeHtml(
        t(CHANNEL_KEYS[guide.channel])
      )}</span></a></li>`
  ).join('\n');

  return {
    path: PATHS.guides,
    title: t('site.indexTitle'),
    description: t('site.indexDescription', { banks }),
    article: true,
    body: `<h1>${escapeHtml(t('site.indexTitle'))}</h1>
<p class="muted">${escapeHtml(t('guide.subtitle'))}</p>
<section class="card">
<ul class="banks">
${rows}
<li><a href="${href(pagePath(code, guidePath(OTHER_SLUG)))}">${escapeHtml(t('guide.otherBank'))}<span>${escapeHtml(
      t('guide.otherBankSub')
    )}</span></a></li>
</ul>
</section>
<p class="muted">${escapeHtml(t('site.intro'))}</p>`,
  };
}

export const guidePages = (ctx: SiteContext): Page[] => [
  indexPage(ctx),
  ...BANK_GUIDES.map((guide) => guidePage(ctx, guide)),
  guidePage(ctx, null),
];
