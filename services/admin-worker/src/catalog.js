// Published guide's six current article categories, aligned with src/data/catalog.ts.
// The article list is fetched from GitHub main, not guessed from feedback votes.
// Cross-listed entries also appear in their secondary current website categories.
import { listArticles } from './articles.js';

export const GUIDE_CATEGORIES = Object.freeze([
  { slug:'basics', name:'認識地方實踐' },
  { slug:'organizations', name:'組織成立與經營' },
  { slug:'plans', name:'計畫與資源' },
  { slug:'finance', name:'經費與財務' },
  { slug:'people', name:'人事與法律' },
  { slug:'tools', name:'工作工具與技能' }
]);
const SECONDARY = Object.freeze({
  finance:['income-withholding','business-income-tax'],
  people:['comprehensive-income-tax']
});
export const validCategory = value => GUIDE_CATEGORIES.some(x=>x.slug===value);
export function categorizeArticle(item) {
  const slug=String(item?.slug||'');
  const primary=String(item?.category||'');
  const memberships=GUIDE_CATEGORIES
    .filter(x=>x.slug===primary||(SECONDARY[x.slug]||[]).includes(slug))
    .map(x=>x.slug);
  return {
    slug,title:String(item?.title||slug).slice(0,125),
    category:validCategory(primary)?primary:'',
    categories:memberships
  };
}
export async function getArticleCategoryIndex(env,fetcher=fetch){
  const response=await listArticles(fetcher,env);
  if(response.status!==200||!response.body?.ok){
    return {status:503,body:{ok:false,error:'暫時無法讀取網站正式文章分類，請稍後重新整理。'}};
  }
  const items=(response.body.items||[]).map(categorizeArticle)
    .filter(x=>/^[a-z0-9][a-z0-9-]{1,85}$/.test(x.slug));
  return {status:200,body:{ok:true,categories:GUIDE_CATEGORIES,items,
    source:'GitHub main 的正式文章分類',
    note:'每篇文章以正式網站的分類為準；同時出現在其他分類的詞條也會列入該分類。'}};
}
