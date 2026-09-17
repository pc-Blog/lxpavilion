"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import Dialog, { ghostBtnStyle, inputStyle, primaryBtnStyle } from "./Dialog";
import * as categoryApi from "@/lib/api/music-category";
import type { MusicCategory } from "@/lib/types";

interface Props {
  onClose: () => void;
}

const PAGE_SIZE = 10;

/**
 * 分类管理弹窗。
 *
 * <p>复刻源项目 {@code views/singerSide/com/EditCategoryButton.vue}：
 * 表格（分页）+ 底部添加表单 + 独立编辑态，对应 Blog 后端的
 * {@code /api/music-category} 增删改查。</p>
 */
export default function CategoryManagerDialog({ onClose }: Props) {
  const [rows, setRows] = useState<MusicCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<MusicCategory | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoryApi.getPage(pageNum, PAGE_SIZE);
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
      setError("请输入分类名称");
      return;
    }
    setError("");
    try {
      await categoryApi.create({ id: 0, name: newName.trim() });
      setNewName("");
      setPageNum(1);
      await load();
    } catch {
      setError("添加分类失败");
    }
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) {
      setError("分类名称不能为空");
      return;
    }
    setError("");
    try {
      await categoryApi.update(editing);
      setEditing(null);
      await load();
    } catch {
      setError("更新分类失败");
    }
  };

  const handleDelete = async (c: MusicCategory) => {
    setError("");
    try {
      await categoryApi.remove(c.id);
      if (rows.length === 1 && pageNum > 1) setPageNum((p) => p - 1);
      else await load();
    } catch {
      setError("删除分类失败");
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog
      title={editing ? "编辑分类" : "分类管理"}
      onClose={onClose}
      width={640}
      footer={
        <button onClick={onClose} style={ghostBtnStyle}>
          关闭
        </button>
      }
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm w-[70px]" style={{ color: "rgba(200,220,240,0.9)" }}>
              分类名称
            </span>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(null)} style={ghostBtnStyle}>
              取消
            </button>
            <button onClick={handleSaveEdit} style={primaryBtnStyle}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div
            className="rounded overflow-hidden"
            style={{ border: "0.5px solid rgba(120,230,255,0.15)" }}
          >
            <div
              className="flex px-3 py-2 text-xs font-medium"
              style={{
                backgroundColor: "rgba(70,70,80,0.7)",
                color: "rgba(180,220,255,0.9)",
              }}
            >
              <span className="w-12">ID</span>
              <span className="flex-1">分类名称</span>
              <span className="w-32 text-center">操作</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {rows.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center px-3 py-2 text-xs"
                  style={{ borderTop: "0.5px solid rgba(120,230,255,0.08)" }}
                >
                  <span className="w-12" style={{ color: "rgba(160,180,200,0.7)" }}>
                    {c.id}
                  </span>
                  <span className="flex-1" style={{ color: "rgba(220,230,240,0.9)" }}>
                    {c.name}
                  </span>
                  <span className="w-32 flex justify-center gap-3">
                    <button
                      onClick={() => setEditing(c)}
                      className="flex items-center gap-1"
                      style={{ color: "rgba(120,200,255,0.9)" }}
                    >
                      <Pencil size={12} /> 编辑
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      style={{ color: "rgba(255,120,120,0.9)" }}
                    >
                      删除
                    </button>
                  </span>
                </div>
              ))}
              {!loading && rows.length === 0 && (
                <div
                  className="py-8 text-center text-xs"
                  style={{ color: "rgba(160,180,200,0.7)" }}
                >
                  暂无分类数据
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              className="text-xs disabled:opacity-30"
              style={{ color: "rgba(180,200,220,0.9)" }}
            >
              上一页
            </button>
            <span className="text-xs" style={{ color: "rgba(180,200,220,0.7)" }}>
              {pageNum} / {pageCount}（共 {total} 个）
            </span>
            <button
              onClick={() => setPageNum((p) => Math.min(pageCount, p + 1))}
              disabled={pageNum >= pageCount}
              className="text-xs disabled:opacity-30"
              style={{ color: "rgba(180,200,220,0.9)" }}
            >
              下一页
            </button>
          </div>

          <div
            className="flex items-center gap-3 pt-4"
            style={{ borderTop: "0.5px solid rgba(120,230,255,0.15)" }}
          >
            <span className="text-sm w-[70px]" style={{ color: "rgba(200,220,240,0.9)" }}>
              分类名称
            </span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="请输入分类名称"
              style={inputStyle}
            />
            <button onClick={handleAdd} style={primaryBtnStyle}>
              添加
            </button>
          </div>

          {error && (
            <div className="text-xs" style={{ color: "rgba(255,120,120,0.9)" }}>
              {error}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
