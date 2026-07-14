"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { updateProfile, changePassword, deleteAccount, getMe } from "@/lib/api/auth";
import Link from "next/link";

const TABS = ["Profile", "Password", "Account"];

export default function ProfilePage() {
  const { user, isLoggedIn, hydrated, setAuth, logout } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState(0);

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    // 刷新用户数据（获取时间字段等）
    getMe().then((fresh) => {
      setAuth(useAuthStore.getState().token || "", fresh);
      setNickname(fresh.nickname || "");
      setEmail(fresh.email || "");
    }).catch(() => {
      setNickname(user?.nickname || "");
      setEmail(user?.email || "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isLoggedIn, router]);

  if (!hydrated) return null;
  if (!isLoggedIn || !user) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const updated = await updateProfile({
        nickname: nickname.trim() || undefined,
        email: email.trim() || undefined,
      });
      setAuth(useAuthStore.getState().token || "", updated);
      setSaveMsg("已保存");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setChangeMsg("两次密码不一致");
      return;
    }
    setChanging(true);
    setChangeMsg("");
    try {
      await changePassword(oldPassword, newPassword);
      setChangeMsg("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setChangeMsg(err instanceof Error ? err.message : "修改失败");
    } finally {
      setChanging(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      router.push("/");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 mb-16 w-full">
      <div className="glass-card p-6 w-full">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Profile</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">Manage your account.</p>

        {/* Tab 切换栏 */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`flex-1 pb-2 text-sm font-bold transition-colors ${
                tab === i
                  ? "text-indigo-500 border-b-2 border-indigo-500"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab 1: 基本信息 */}
        {tab === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Username</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname"
                className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Not set"
                className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {saveMsg && (
                <span className={`text-xs ${saveMsg === "已保存" ? "text-green-500" : "text-red-500"}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: 修改密码 */}
        {tab === 1 && (
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Current password"
              className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
            />
            {changeMsg && (
              <p className={`text-xs ${changeMsg === "密码修改成功" ? "text-green-500" : "text-red-500"}`}>
                {changeMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={changing}
              className="py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {changing ? "Changing..." : "Change Password"}
            </button>
          </form>
        )}

        {/* Tab 3: 账号信息 */}
        {tab === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Account Info</h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p>Created: {user.createTime || "-"}</p>
                <p>Updated: {user.updateTime || "-"}</p>
                <p>Last login: {user.loginTime || "-"}</p>
                <p>GitHub: {user.githubId ? "Linked" : "Not linked"}</p>
              </div>
            </div>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 border border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold rounded-xl transition-colors"
              >
                Delete Account
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-red-500 text-center">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部操作 */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between">
          <Link href="/" className="text-xs text-slate-400 hover:text-indigo-500 transition-colors">
            ← Back to Home
          </Link>
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
