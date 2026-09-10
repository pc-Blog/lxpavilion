import EditChatterClient from "./EditChatterClient";

export const revalidate = 0;

export function generateStaticParams() {
  // Next 16.3+ 在 output: export 下禁止返回空数组（PR #95969），
  // 静态导出时生成一个占位 id 使构建通过；动态模式维持原行为。
  return process.env.STATIC_EXPORT === "true" ? [{ id: "0" }] : [];
}

export default function EditChatterPage(props: { params: Promise<{ id: string }> }) {
  return <EditChatterClient params={props.params} />;
}
