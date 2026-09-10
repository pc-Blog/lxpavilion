import EditArticleClient from "./EditArticleClient";

export const revalidate = 0;

export function generateStaticParams() {
  // Next 16.3+ 在 output: export 下禁止返回空数组（PR #95969），
  // 静态导出时生成一个占位 id 使构建通过；动态模式维持原行为。
  return process.env.STATIC_EXPORT === "true" ? [{ id: "0" }] : [];
}

export default function EditArticlePage(props: { params: Promise<{ id: string }> }) {
  return <EditArticleClient params={props.params} />;
}
