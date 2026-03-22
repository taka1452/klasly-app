import Link from "next/link";
import { notFound } from "next/navigation";
import { helpCategories } from "@/data/help-categories";
import { getArticlesByCategory } from "@/data/help-articles";
import {
  Rocket,
  Calendar,
  Users,
  CreditCard,
  FileCheck,
  MessageSquare,
  Building2,
  Mountain,
  BarChart3,
  Settings,
  BookOpen,
  ChevronRight,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="h-7 w-7" />,
  Calendar: <Calendar className="h-7 w-7" />,
  Users: <Users className="h-7 w-7" />,
  CreditCard: <CreditCard className="h-7 w-7" />,
  FileCheck: <FileCheck className="h-7 w-7" />,
  MessageSquare: <MessageSquare className="h-7 w-7" />,
  Building2: <Building2 className="h-7 w-7" />,
  Mountain: <Mountain className="h-7 w-7" />,
  BarChart3: <BarChart3 className="h-7 w-7" />,
  Settings: <Settings className="h-7 w-7" />,
  BookOpen: <BookOpen className="h-7 w-7" />,
};

type Props = {
  params: Promise<{ category: string }>;
};

export default async function CategoryPage({ params }: Props) {
  const { category: categoryId } = await params;
  const category = helpCategories.find((c) => c.id === categoryId);

  if (!category) return notFound();

  const articles = getArticlesByCategory(categoryId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/help" className="hover:text-brand-600 transition-colors">
            Help Center
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-gray-900">{category.title}</span>
        </nav>

        {/* Category Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {ICON_MAP[category.icon] ?? null}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {category.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {category.description}
            </p>
          </div>
        </div>

        {/* Article List */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {articles.map((article, i) => (
            <Link
              key={article.id}
              href={`/help/${categoryId}/${article.id}`}
              className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50 ${
                i < articles.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-medium text-gray-900">
                  {article.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {article.summary}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
            </Link>
          ))}
          {articles.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              No articles in this category yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
