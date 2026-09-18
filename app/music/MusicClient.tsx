"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveBackground from "./_components/WaveBackground";
import FloatingDraggable from "./_components/FloatingDraggable";
import MusicPlayer from "./_components/MusicPlayer";
import SingerSidebar from "./_components/SingerSidebar";
import TrackHeader from "./_components/TrackHeader";
import TrackList from "./_components/TrackList";
import MusicPagination from "./_components/MusicPagination";
import UploadDialog from "./_components/UploadDialog";
import EditTrackDialog from "./_components/EditTrackDialog";
import SingerManagerDialog from "./_components/SingerManagerDialog";
import CategoryManagerDialog from "./_components/CategoryManagerDialog";
import * as musicApi from "@/lib/api/music";
import * as singerApi from "@/lib/api/singer";
import * as categoryApi from "@/lib/api/music-category";
import { useMusicStore } from "@/stores/musicStore";
import type { Music, Singer, MusicCategory } from "@/lib/types";
import { detectMode } from "@/lib/static-data";

/** 列表每页条数，与源项目 SongPagination 的候选值一致 */
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

/**
 * 音乐模块主壳。
 *
 * <p>复刻源项目 {@code music/App.vue} 的外壳（黑底 canvas + 容器）与
 * {@code views/main/index.vue} 的布局（左侧栏 15% + 内容区 flex:1）。
 * 源项目的「音乐 / 歌手」Tab 切换已取消：歌手管理降级为左侧栏的一个按钮，
 * 与分类管理同构。</p>
 */
export default function MusicClient() {
  // 查询条件
  const [title, setTitle] = useState("");
  const [singerId, setSingerId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 列表数据
  const [rows, setRows] = useState<Music[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 下拉数据源
  const [singers, setSingers] = useState<Singer[]>([]);
  const [categories, setCategories] = useState<MusicCategory[]>([]);

  // 本地（live）模式才展示管理功能
  const [isLive, setIsLive] = useState(false);

  // 当前播放曲目，「定位歌曲」用它；直接取全局播放状态，无需本地副本
  const currentMusicId = useMusicStore((s) => s.currentTrack?.id ?? null);

  /** 已跟随过的曲目 id；undefined 表示尚未初始化（首次拿到的曲目只登记、不跟随） */
  const followedIdRef = useRef<number | null | undefined>(undefined);
  /** 定位请求序号：并列的切歌只认最后一次，避免慢响应把页码覆盖回去 */
  const locateSeqRef = useRef(0);

  // 弹窗
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<Music | null>(null);
  const [showSingerMgr, setShowSingerMgr] = useState(false);
  const [showCategoryMgr, setShowCategoryMgr] = useState(false);

  const query = useMemo(
    () => ({ title, singerId, categoryId, onlyFavorite }),
    [title, singerId, categoryId, onlyFavorite],
  );

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await musicApi.getPage(pageNum, pageSize, query);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [pageNum, pageSize, query]);

  const fetchOptions = useCallback(async () => {
    const [s, c] = await Promise.all([singerApi.getAll(), categoryApi.getAll()]);
    setSingers(s);
    setCategories(c);
  }, []);

  useEffect(() => {
    detectMode().then((m) => setIsLive(m === "live"));
  }, []);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPageNum(1);
  }, [title, singerId, categoryId, onlyFavorite]);

  const handleToggleFavorite = async (m: Music) => {
    await musicApi.toggleFavorite(m.id);
    await fetchPage();
  };

  /**
   * 「定位歌曲」：算出曲目所在页码并跳转，对应源项目 getMusicPosition。
   *
   * <p>用 {@code getPage} 拉全量再按索引算页码，而不是用 {@code /music/play} 返回的
   * position：一是静态模式没有后端、拿不到 position；二是那个 position 由请求里的
   * {@code pageSize} 算出（{@code lib/api/music.ts} 固定为 20），与页面实际可选的
   * 5/10/20/50 不一致，只有每页恰好 20 条时才准。</p>
   */
  const handleLocate = useCallback(async (id: number) => {
    const seq = ++locateSeqRef.current;
    const data = await musicApi.getPage(1, 1_000_000, query);
    if (seq !== locateSeqRef.current) return;
    const idx = (data.rows ?? []).findIndex((m) => m.id === id);
    if (idx < 0) return;
    const target = Math.floor(idx / pageSize) + 1;
    // 页码没变（列表快照过期等）也要重新拉一次，否则点了没有任何反馈
    if (target === pageNum) await fetchPage();
    else setPageNum(target);
  }, [query, pageSize, pageNum, fetchPage]);

  /**
   * 切歌后跟随翻页，对应源项目 {@code getNextMusic} 里的三处「不在当前页就改页码 +
   * fetchMusicPage()」：顺序模式越界往后翻、反向越界往前翻、随机模式随机到哪页跳哪页。
   *
   * <p>源项目把跟随写在选曲流程里；Blog 的选曲分散在后端与模块级 hook 中（都拿不到
   * 页码），因此在页面这一层统一跟随——列表点播、悬浮播放器上/下一首、播完自动切歌、
   * 浏览器媒体控件切歌，走到的都是这里。新歌已在当前页时不请求（列表点播、页内切歌
   * 都属于这种情况）。</p>
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    // 首次拿到的曲目（含进入页面时 hook 预取的那首）只登记、不跟随：跟随只发生在切歌时
    if (followedIdRef.current === undefined) {
      followedIdRef.current = currentMusicId;
      return;
    }
    if (followedIdRef.current === currentMusicId) return;
    followedIdRef.current = currentMusicId;
    if (rows.some((m) => m.id === currentMusicId)) return;
    handleLocate(currentMusicId);
  }, [currentMusicId, rows, handleLocate]);

  return (
    <>
      <WaveBackground />

      {/*
        悬浮播放器：源项目 views/main/index.vue:28-30 把 MusicPlayer 包在
        FloatingDraggable 里。scope 传当前筛选条件，让上一首/下一首与自动切歌
        都在当前列表范围内选曲（源 getNextMusic 的 query 默认取页面查询条件）。
      */}
      <FloatingDraggable>
        <MusicPlayer scope={query} />
      </FloatingDraggable>

      {/*
        高度链：源项目是 #app{height:100vh} → .home-container{height:100%}
        → .main-layout{height:100%}，全程「确定高度」，因此内部 SongList 的
        max-height:60% 才能生效。这里同样要给出确定高度，不能用 minHeight —— 
        否则百分比无法解析，列表不再滚动，内容会把整页撑高并出现页面级滚动条。
      */}
      <div
        className="relative"
        style={{
          height: "100vh",
          padding: "clamp(16px, 4vw, 64px)",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* 主容器：源项目 main/index.vue 的 .main-layout */}
        <div
          className="flex w-full h-full rounded-[25px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(35,35,45,0.38) 0%, rgba(45,45,60,0.45) 100%)",
          }}
        >
          {/* 左侧栏：15%，最小 175px */}
          <div className="w-[15%] min-w-[175px] h-full overflow-hidden">
            <SingerSidebar
              singers={singers}
              activeSingerId={singerId}
              onSelect={(id) => setSingerId(id)}
              isLive={isLive}
              onManageSingers={() => setShowSingerMgr(true)}
              onManageCategories={() => setShowCategoryMgr(true)}
            />
          </div>

          {/* 内容区：源 .content-container（flex:1 + overflow-y:auto） */}
          <div className="flex-1 p-5 box-border overflow-hidden">
            <div className="mt-song-container flex flex-col h-full p-5 min-h-0">
              <TrackHeader
                currentMusicId={currentMusicId}
                isLive={isLive}
                title={title}
                onTitleChange={setTitle}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                onlyFavorite={onlyFavorite}
                onToggleFavoriteFilter={() => setOnlyFavorite((v) => !v)}
                categories={categories}
                onAdd={() => setShowUpload(true)}
                onLocate={handleLocate}
              />

              <TrackList
                rows={rows}
                loading={loading}
                isLive={isLive}
                onEdit={setEditing}
                onToggleFavorite={handleToggleFavorite}
              />

              <MusicPagination
                pageNum={pageNum}
                pageSize={pageSize}
                total={total}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPageNum}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPageNum(1);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 弹窗 */}
      {showUpload && (
        <UploadDialog
          singers={singers}
          categories={categories}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            setShowUpload(false);
            fetchPage();
          }}
        />
      )}

      {editing && (
        <EditTrackDialog
          music={editing}
          singers={singers}
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            fetchPage();
          }}
        />
      )}

      {showSingerMgr && (
        <SingerManagerDialog
          onClose={() => {
            setShowSingerMgr(false);
            fetchOptions();
          }}
        />
      )}

      {showCategoryMgr && (
        <CategoryManagerDialog
          onClose={() => {
            setShowCategoryMgr(false);
            fetchOptions();
          }}
        />
      )}
    </>
  );
}
