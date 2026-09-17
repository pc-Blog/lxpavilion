"use client";

import { useCallback, useEffect, useState } from "react";
import Dialog from "./Dialog";
import { Edit } from "./icons";
import * as singerApi from "@/lib/api/singer";
import type { Singer } from "@/lib/types";

interface Props {
  onClose: () => void;
}

const PAGE_SIZE = 10;

/**
 * 歌手管理弹窗。
 *
 * <p>源项目的歌手管理是独立的 Tab（SingerSearch + SingerList + SingerCard 共 1046 行），
 * 其中多图管理依赖后端不存在的 {@code /singers/{id}/pictures} 接口。
 * 此处按需求降级为与分类管理同构的「表格 + 分页 + 添加」弹窗，
 * 仅保留后端支持的 增 / 改 / 删 与单张封面字段。</p>
 *
 * <p>表格样式取自 {@code index.scss} 的 {@code .el-table} 段：表头底色
 * {@code rgba(65,65,75,0.8)}、行斑马纹、悬浮转亮。</p>
 */
export default function SingerManagerDialog({ onClose }: Props) {
  const [rows, setRows] = useState<Singer[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Singer | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await singerApi.getPage(pageNum, PAGE_SIZE);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [pageNum]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError("请输入歌手名称");
      return;
    }
    setError("");
    try {
      await singerApi.create({ id: 0, name: newName.trim() });
      setNewName("");
      setPageNum(1);
      await load();
    } catch {
      setError("添加歌手失败");
    }
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) {
      setError("歌手名称不能为空");
      return;
    }
    setError("");
    try {
      await singerApi.update(editing);
      setEditing(null);
      await load();
    } catch {
      setError("更新歌手失败");
    }
  };

  const handleDelete = async (s: Singer) => {
    setError("");
    try {
      await singerApi.remove(s.id);
      if (rows.length === 1 && pageNum > 1) setPageNum((p) => p - 1);
      else await load();
    } catch {
      setError("删除歌手失败");
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog
      title={editing ? "编辑歌手" : "歌手管理"}
      onClose={onClose}
      width={640}
      footer={
        <button onClick={onClose} className="mt-btn">
          关闭
        </button>
      }
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="mt-label">歌手名称</span>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="mt-input flex-1"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(null)} className="mt-btn">
              取消
            </button>
            <button onClick={handleSaveEdit} className="mt-btn mt-btn-primary">
              保存
            </button>
          </div>
          {error && <div className="mt-error">{error}</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 表格 */}
          <div className="mt-table">
            <div className="mt-table-head flex px-3 py-2 text-xs">
              <span className="w-12">ID</span>
              <span className="flex-1">歌手名称</span>
              <span className="w-32 text-center">操作</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {rows.map((s) => (
                <div
                  key={s.id}
                  className="mt-table-row flex items-center px-3 py-2 text-xs"
                >
                  <span className="w-12" style={{ color: "rgba(160,180,200,0.7)" }}>
                    {s.id}
                  </span>
                  <span className="flex-1" style={{ color: "rgba(220,230,240,0.9)" }}>
                    {s.name}
                  </span>
                  <span className="w-32 flex justify-center gap-2">
                    <button onClick={() => setEditing(s)} className="mt-btn">
                      <Edit size={12} /> 编辑
                    </button>
                    <button onClick={() => handleDelete(s)} className="mt-btn mt-btn-danger">
                      删除
                    </button>
                  </span>
                </div>
              ))}
              {!loading && rows.length === 0 && (
                <div className="mt-table-empty py-8 text-center text-xs">
                  暂无歌手数据
                </div>
              )}
            </div>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              className="mt-page-nav"
            >
              上一页
            </button>
            <span className="mt-pagination-total" style={{ margin: 0 }}>
              {pageNum} / {pageCount}（共 {total} 位）
            </span>
            <button
              onClick={() => setPageNum((p) => Math.min(pageCount, p + 1))}
              disabled={pageNum >= pageCount}
              className="mt-page-nav"
            >
              下一页
            </button>
          </div>

          {/* 添加表单 */}
          <div
            className="flex items-center gap-3 pt-4"
            style={{ borderTop: "0.5px solid rgba(120,230,255,0.15)" }}
          >
            <span className="mt-label">歌手名称</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="请输入歌手名称"
              className="mt-input flex-1"
            />
            <button onClick={handleAdd} className="mt-btn mt-btn-primary">
              添加
            </button>
          </div>

          {error && <div className="mt-error">{error}</div>}
        </div>
      )}
    </Dialog>
  );
}
