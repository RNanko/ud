import FeatureArticle from "@/app/components/landing/FeatureArticle";
import { featureArticles } from "@/lib/seo/features";
import { publicMetadata } from "@/lib/seo/metadata";
import "../../landing.css";
const article = featureArticles["workout-planner"];
export const metadata = publicMetadata(article.path, article.title, article.description);
export default function Page() { return <FeatureArticle article={article} />; }
