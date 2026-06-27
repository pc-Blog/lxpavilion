"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Album, Photo } from "@/lib/types";
import { getPublishedList, getPhotosByAlbum } from "@/lib/api/album";
import Loading from "@/app/_components/common/Loading";
import Portal from "@/app/_components/common/Portal";
import { assetUrl } from "@/lib/asset-url";

/* ── PhotoCard ── */
function PhotoCard({ photo, index, onClick }: { photo: Photo; index: number; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);

  const rotation = useMemo(() => {
    const id = photo.id ?? index;
    const seed = String(id).charCodeAt(0) + String(id).charCodeAt(String(id).length - 1);
    return ((seed % 7) - 3) * 0.8;
  }, [photo.id, index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotation * 2 }}
      animate={{ opacity: 1, y: 0, rotate: rotation }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ rotate: 0, scale: 1.03, zIndex: 10, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      onClick={onClick}
      className="relative cursor-pointer group break-inside-avoid mb-3 md:mb-5"
      style={{ transformOrigin: "center center" }}
    >
      <div className="relative bg-white dark:bg-slate-800 p-2 pb-6 md:p-2.5 md:pb-8 rounded-sm shadow-lg dark:shadow-black/30 group-hover:shadow-2xl transition-shadow duration-300">
        <div className="relative overflow-hidden rounded-[1px] aspect-[4/3]">
          <img
            src={assetUrl(photo.url)}
            alt="相册照片"
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
          />
          {!loaded && <div className="w-full aspect-[4/3] bg-slate-200 dark:bg-slate-700 animate-pulse" />}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        </div>
      </div>
      <div className="absolute -top-2 left-2 md:left-3 w-8 h-3 md:w-10 md:h-4 bg-amber-200/60 dark:bg-amber-300/30 rounded-sm -rotate-6 pointer-events-none" style={{ backdropFilter: "blur(2px)" }} />
    </motion.div>
  );
}

/* ── AlbumCard ── */
const STACK_ANGLES = [-4, 0, 3];
const FAN_ANGLES = [-12, 0, 12];

function AlbumCard({
  album, photos, isExpanded, onToggle, onPhotoClick,
}: {
  album: Album; photos: Photo[]; isExpanded: boolean; onToggle: () => void;
  onPhotoClick: (photos: Photo[], index: number) => void;
}) {
  const covers = photos.slice(0, 3).reverse();
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      const h = contentRef.current.scrollHeight;
      if (h > 0) setContentHeight(h);
    } else if (!isExpanded) {
      setContentHeight(0);
    }
  }, [isExpanded]);

  return (
    <div className="rounded-3xl overflow-hidden cursor-pointer" onClick={onToggle}>
      <div className="relative px-4 pt-4 pb-3 md:px-6 md:pt-6 md:pb-4">
        {/* 堆叠照片 */}
        <motion.div
          className="relative h-36 md:h-48 mx-auto max-w-[200px] md:max-w-[260px]"
          initial="rest"
          animate={isExpanded ? "hover" : "rest"}
          whileHover="hover"
        >
          {covers.map((photo, i) => (
            <motion.div
              key={photo.id}
              className="absolute inset-0"
              style={{ zIndex: i + 1 }}
              variants={{
                rest: { rotate: STACK_ANGLES[i] ?? 0, y: i * 12, scale: 1 - i * 0.04 },
                hover: { rotate: FAN_ANGLES[i] ?? 0, y: [-4, -10, -4][i] ?? 0, scale: i === 1 ? 1 : 0.95 },
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                <img src={assetUrl(photo.url)} alt={album.title} className="w-full h-full object-cover" />
              </div>
            </motion.div>
          ))}
          <div className="absolute -bottom-2 right-0 z-20 px-2 py-0.5 md:px-2.5 rounded-full bg-sky-500 text-white text-[10px] md:text-xs font-bold shadow-lg shadow-sky-500/30">
            {photos.length} 张
          </div>
        </motion.div>

        <div className="mt-4 md:mt-6 text-center">
          <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">{album.title}</h3>
          {album.description && (
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">{album.description}</p>
          )}
        </div>
      </div>

      {/* 展开区域：CSS transition 驱动高度，避免 framer-motion height:auto 强制回流 */}
      <div
        className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ height: contentHeight, opacity: isExpanded ? 1 : 0 }}
      >
        <div ref={contentRef}>
          <div className="px-4 pb-6 md:px-6">
            <div className="p-4 md:p-6 rounded-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-5">
                {photos.map((photo, i) => (
                  <PhotoCard key={photo.id} photo={photo} index={i} onClick={() => onPhotoClick(photos, i)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Lightbox ── */
function Lightbox({
  photos, index, open, onClose, onPrev, onNext,
}: {
  photos: Photo[]; index: number; open: boolean; onClose: () => void; onPrev?: () => void; onNext?: () => void;
}) {
  const photo = photos[index];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft") onPrev?.();
    if (e.key === "ArrowRight") onNext?.();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && photo && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {photos.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); onPrev?.(); }} className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          {photos.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); onNext?.(); }} className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}

          <motion.div
            key={photo.id}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 max-w-[90vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={assetUrl(photo.url)} alt="相片预览" className="max-h-[85vh] w-auto object-contain rounded-lg shadow-2xl" />
          </motion.div>

          {photos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 text-center z-10">
              <span className="text-sm text-white/50">{index + 1} / {photos.length}</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── 主页面 ── */
export default function GalleryClient() {
  const [albums, setAlbums] = useState<(Album & { photos: Photo[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);

  // Click outside to collapse
  useEffect(() => {
    if (expandedId === null) return;
    const handler = (e: MouseEvent) => {
      if (lightboxOpen) return;
      if (expandedRef.current && !expandedRef.current.contains(e.target as Node)) {
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedId, lightboxOpen]);

  // Load all albums with photos
  useEffect(() => {
    (async () => {
      try {
        const list = await getPublishedList();
        const raw = Array.isArray(list) ? list : [];
        const enriched = await Promise.all(
          raw.map(async (a) => {
            const p = await getPhotosByAlbum(a.id!).catch(() => []);
            return { ...a, photos: Array.isArray(p) ? p : [] };
          })
        );
        setAlbums(enriched);
      } catch { setAlbums([]); } finally { setLoading(false); }
    })();
  }, []);

  const openLightbox = useCallback((photos: Photo[], index: number) => {
    setLightbox({ photos, index });
    setLightboxOpen(true);
  }, []);

  return (
    <div className="py-6 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-12"
      >
        <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          <svg className="w-5 h-5 md:w-7 md:h-7 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <div className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">Gallery</div>
        </div>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 ml-7 md:ml-10">Moments captured through the lens.</p>
      </motion.div>

      {loading ? (
        <div className="py-24"><Loading /></div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 md:py-32 text-slate-400">
          <svg className="w-8 h-8 md:w-12 md:h-12 mb-3 md:mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <p className="text-sm md:text-base">暂无相册</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {expandedId === null ? (
            /* ── 网格视图 ── */
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 select-none"
            >
              {albums.map((album) => (
                <div key={album.id}>
                  <div>
                    <AlbumCard
                      album={album}
                      photos={album.photos}
                      isExpanded={false}
                      onToggle={() => { if (album.id != null) setExpandedId(album.id); }}
                      onPhotoClick={openLightbox}
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            /* ── 展开视图 ── */
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-w-4xl mx-auto"
            >
              {albums.filter((a) => a.id === expandedId).map((album) => (
                <div key={album.id} ref={expandedRef}>
                  <AlbumCard
                    album={album}
                    photos={album.photos}
                    isExpanded={true}
                    onToggle={() => setExpandedId(null)}
                    onPhotoClick={openLightbox}
                  />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
      {lightbox && (
        <Portal>
          <Lightbox
            photos={lightbox.photos}
            index={lightbox.index}
            open={lightboxOpen}
            onClose={() => { setLightboxOpen(false); setLightbox(null); }}
            onPrev={() => setLightbox((p) => p ? { ...p, index: (p.index - 1 + p.photos.length) % p.photos.length } : null)}
            onNext={() => setLightbox((p) => p ? { ...p, index: (p.index + 1) % p.photos.length } : null)}
          />
        </Portal>
      )}
    </div>
  );
}
