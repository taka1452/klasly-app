import Link from "next/link";
import { notFound } from "next/navigation";
import { helpCategories } from "@/data/help-categories";
import { getArticleById, helpArticles } from "@/data/help-articles";
import { ChevronRight, Lightbulb, AlertCircle } from "lucide-react";

type Props = {
  params: Promise<{ category: string; article: string }>;
};

export default async function ArticlePage({ params }: Props) {
  const { category: categoryId, article: articleId } = await params;
  const category = helpCategories.find((c) => c.id === categoryId);
  const article = getArticleById(articleId);

  if (!category || !article || article.category !== categoryId) {
    return notFound();
  }

  const relatedArticles = (article.relatedArticles ?? [])
    .map((id) => helpArticles.find((a) => a.id === id))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        {/* Breadcrumb */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Link href="/help" className="hover:text-brand-600 transition-colors">
            Help Center
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href={`/help/${categoryId}`}
            className="hover:text-brand-600 transition-colors"
          >
            {category.title}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-gray-900">{article.title}</span>
        </nav>

        {/* Article Content */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          {/* Title & Summary */}
          <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            {article.summary}
          </p>

          {/* Prerequisites */}
          {article.prerequisites && article.prerequisites.length > 0 && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Prerequisites
                </p>
                <ul className="mt-1 space-y-1 text-sm text-amber-800">
                  {article.prerequisites.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
                {article.audience.length > 0 && (
                  <p className="mt-1 text-sm text-amber-800">
                    • Role:{" "}
                    {article.audience
                      .map((a) => a.charAt(0).toUpperCase() + a.slice(1))
                      .join(" or ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="mt-8 space-y-6">
            {article.steps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
                  {index + 1}
                </div>
                <div className="pt-0.5">
                  <h3 className="font-medium text-gray-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {article.tips && article.tips.length > 0 && (
            <div className="mt-8 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Lightbulb className="h-5 w-5" />
                <span className="text-sm font-semibold">Tips</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {article.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-sm text-blue-800 leading-relaxed"
                  >
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <h2 className="text-sm font-semibold text-gray-900">
                Related articles
              </h2>
              <ul className="mt-3 space-y-2">
                {relatedArticles.map((related) => (
                  <li key={related!.id}>
                    <Link
                      href={`/help/${related!.category}/${related!.id}`}
                      className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      {related!.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
