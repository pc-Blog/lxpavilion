"use client";

import { useState, useEffect, useCallback } from "react";
import type { Email } from "@/lib/types";
import { getEmailList, getEmailDetail, deleteEmail, getForwardTarget, sendEmail } from "@/lib/api/email";
import { siteConfig } from "@/lib/siteConfig";
import Tooltip from "@/app/_components/common/Tooltip";
import Dialog from "@/app/_components/common/Dialog";
import Pagination from "@/app/_components/common/Pagination";
import { showSuccessToast } from "@/lib/toast";
import { useConfirm } from "@/app/_components/common/ConfirmDialog";

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEmailPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Filter
  const [filterDir, setFilterDir] = useState<"all" | "in" | "out">("all");

  // Forward target
  const [forwardTarget, setForwardTarget] = useState("");

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [bodyTab, setBodyTab] = useState<"text" | "html">("text");

  // Send test email
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testToName, setTestToName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testBody, setTestBody] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async (pn?: number, ps?: number, dir?: "all" | "in" | "out") => {
    const d = dir || filterDir;
    try {
      const result = await getEmailList(pn || 1, ps || pageSize, d === "all" ? undefined : d);
      setEmails(result.list);
      setTotal(result.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [pageSize, filterDir]);

  useEffect(() => {
    Promise.all([
      refresh(1, pageSize),
      getForwardTarget().then((r) => setForwardTarget(r.address)).catch(() => {}),
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleView = async (id: number) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const email = await getEmailDetail(id);
      setSelectedEmail(email);
    } catch {
      setSelectedEmail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const switchFilter = (dir: "all" | "in" | "out") => {
    setFilterDir(dir);
    setPageNum(1);
    refresh(1, pageSize, dir);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm("确认删除此邮件？");
    if (!ok) return;
    await deleteEmail(id);
    showSuccessToast("已删除");
    refresh(pageNum, pageSize);
  };

  const handleReply = (email: Email) => {
    if (email.direction === "out") {
      setTestTo(email.to_addr || "");
      setTestToName(email.to_name || "");
    } else {
      setTestTo(email.from_addr);
      setTestToName(email.from_name || "");
    }
    setTestSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setTestBody("");
    setTestOpen(true);
    // 滚动到发送区域
    setTimeout(() => document.querySelector(".mb-4")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSendTest = async () => {
    if (!testTo.trim()) return;
    setSending(true);
    try {
      await sendEmail(testTo.trim(), testSubject.trim() || `【${siteConfig.navTitle}】发件功能测试`, testBody.trim() || "这是一封来自后台的测试邮件。", testToName.trim() || undefined);
      showSuccessToast("发送成功");
      refresh(pageNum, pageSize);
      setTestTo("");
      setTestToName("");
      setTestSubject("");
      setTestBody("");
      setTestOpen(false);
    } catch {
      /* error handled by workerFetch */
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">邮箱管理</h1>

      {/* 转发目标 */}
      <div className="glass-card !rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
        <span className="text-slate-400">转发目标：</span>
        <code className="text-indigo-500 font-mono font-bold">{forwardTarget || "未配置"}</code>
      </div>

      {/* 发送邮件 */}
      <div className="mb-4">
        <button
          onClick={() => setTestOpen(!testOpen)}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {testOpen ? "收起" : "发送邮件"}
        </button>

        {testOpen && (
          <div className="glass-card !rounded-xl mt-3 p-4 space-y-3">
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="收件人邮箱"
              className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50"
            />
            <input
              value={testToName}
              onChange={(e) => setTestToName(e.target.value)}
              placeholder="收件人名称（选填）"
              className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50"
            />
            <input
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              placeholder="邮件主题（选填）"
              className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50"
            />
            <textarea
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              placeholder="邮件正文（选填）"
              rows={3}
              className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setTestOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">取消</button>
              <button onClick={handleSendTest} disabled={sending || !testTo.trim()}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                {sending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {sending ? "发送中..." : "发送"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-1 mb-3">
        {(["all", "in", "out"] as const).map((d) => (
          <button key={d} onClick={() => switchFilter(d)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterDir === d
                ? "bg-indigo-500 text-white"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            {d === "all" ? "全部" : d === "in" ? "收件" : "发件"}
          </button>
        ))}
      </div>

      {/* 邮件列表表格 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
              <th className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-slate-400 w-10">#</th>
              <th className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-slate-400">名称</th>
              <th className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-slate-400">邮箱</th>
              <th className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-slate-400">主题</th>
              <th className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-slate-400">时间</th>
              <th className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-slate-400">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {emails.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">暂无邮件</td>
              </tr>
            ) : (
              emails.map((email) => (
                <tr key={email.id} className="hover:bg-white/20 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3">
                    {email.direction === "out" ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold" title="已发送">发</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold" title="已接收">收</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                    {email.direction === "out" ? (email.to_name || "—") : (email.from_name || "—")}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                    {email.direction === "out" ? email.to_addr : email.from_addr}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200 max-w-[300px] truncate font-medium">{email.subject}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{formatTime(email.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Tooltip text="查看详情">
                        <button onClick={() => handleView(email.id)} className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </Tooltip>
                      {email.direction !== "out" && (
                        <Tooltip text="回复">
                          <button onClick={() => handleReply(email)} className="p-1 text-sky-400 hover:text-sky-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip text="删除">
                        <button onClick={() => handleDelete(email.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        total={total}
        pageNum={pageNum}
        pageSize={pageSize}
        onChange={(pn) => { setPageNum(pn); refresh(pn, pageSize); }}
        onPageSizeChange={(ps) => { setPageSize(ps); setPageNum(1); refresh(1, ps); }}
      />

      {/* 详情 Dialog */}
      <Dialog open={detailOpen} onClose={() => { setDetailOpen(false); setSelectedEmail(null); }} title="邮件详情">
        {detailLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedEmail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
              <span className="text-slate-400">{selectedEmail.direction === "out" ? "收件人：" : "发件人："}</span>
              <span className="text-slate-700 dark:text-slate-200 break-all">
                {selectedEmail.direction === "out"
                  ? (selectedEmail.to_name
                    ? <><span className="font-medium">{selectedEmail.to_name}</span> &lt;{selectedEmail.to_addr}&gt;</>
                    : (selectedEmail.to_addr || "—"))
                  : (selectedEmail.from_name
                    ? <><span className="font-medium">{selectedEmail.from_name}</span> &lt;{selectedEmail.from_addr}&gt;</>
                    : selectedEmail.from_addr)}
              </span>
              <span className="text-slate-400">{selectedEmail.direction === "out" ? "发件人：" : "收件人："}</span>
              <span className="text-slate-500 dark:text-slate-400">我 &lt;{selectedEmail.direction === "out" ? selectedEmail.from_addr : selectedEmail.to_addr}&gt;</span>
              <span className="text-slate-400">主题：</span>
              <span className="text-slate-700 dark:text-slate-200 font-medium">{selectedEmail.subject}</span>
              <span className="text-slate-400">时间：</span>
              <span className="text-slate-500">{formatTime(selectedEmail.created_at)}</span>
              {selectedEmail.forward_to && (
                <>
                  <span className="text-slate-400">转发至：</span>
                  <span className="text-slate-500">{selectedEmail.forward_to}</span>
                </>
              )}
            </div>

            {(selectedEmail.text_body || selectedEmail.html_body) && (
              <div>
                <div className="flex gap-2 mb-2">
                  {selectedEmail.text_body && (
                    <button
                      onClick={() => setBodyTab("text")}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                        bodyTab === "text"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      文本
                    </button>
                  )}
                  {selectedEmail.html_body && (
                    <button
                      onClick={() => setBodyTab("html")}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                        bodyTab === "html"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      HTML
                    </button>
                  )}
                </div>
                {bodyTab === "text" && selectedEmail.text_body && (
                  <pre className="glass-card !rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words max-h-60 overflow-y-auto bg-white/50 dark:bg-slate-800/50">
                    {selectedEmail.text_body}
                  </pre>
                )}
                {bodyTab === "html" && selectedEmail.html_body && (
                  <div className="glass-card !rounded-xl p-3 text-xs max-h-60 overflow-y-auto bg-white/50 dark:bg-slate-800/50">
                    <iframe
                      srcDoc={selectedEmail.html_body}
                      className="w-full h-48 border-0"
                      title="邮件 HTML 预览"
                      sandbox=""
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-400 text-center py-4">加载失败</div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => { setDetailOpen(false); setSelectedEmail(null); }} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            关闭
          </button>
        </div>
      </Dialog>

      {ConfirmDialog}
    </div>
  );
}
