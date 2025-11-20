import React, { useState } from "react";

type Voice = {
    id: string;
    name: string;
    language: string;
    gender: string;
    tags: string[];
    avatarUrl?: string;
};

const SAMPLE_IMAGE = "/mnt/data/133f8f2f-9a21-4fe8-873d-ff4107430ab6.png";

const sampleVoices: Voice[] = [
    { id: "1", name: "Alice", language: "English", gender: "Female", tags: ["Free", "With facemotion"], avatarUrl: SAMPLE_IMAGE },
    { id: "2", name: "Anderson", language: "English", gender: "Female", tags: ["Free", "With facemotion"], avatarUrl: SAMPLE_IMAGE },
    { id: "3", name: "Andrew", language: "English", gender: "Female", tags: ["Free", "With facemotion"], avatarUrl: SAMPLE_IMAGE },
    { id: "4", name: "Alisa", language: "English", gender: "Female", tags: ["Free", "With facemotion"], avatarUrl: SAMPLE_IMAGE },
];

export default function VoiceDashboard() {
    const [query, setQuery] = useState("");
    const [voices, setVoices] = useState<Voice[]>(sampleVoices);
    const [sort, setSort] = useState<string>("latest");

    const filtered = voices.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()));

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-300 text-purple-900">
                <div className="flex">
                    {/* Sidebar */}
                    <aside className="w-24 bg-purple-900/10 backdrop-blur border-r border-purple-300 h-screen sticky top-0 flex flex-col items-center py-8 gap-8 shadow-inner">
                        <div className="text-sm font-bold tracking-wide text-purple-700">Voxxy+</div>
                        <nav className="flex flex-col items-center gap-6 w-full">
                            <SidebarButton label="Home" />
                            <SidebarButton label="Voice" active />
                            <SidebarButton label="Facemotion" />
                            <SidebarButton label="My project" />
                            <SidebarButton label="Speech maker" />
                            <SidebarButton label="Video Gen" />
                        </nav>
                        <div className="mt-auto pb-4">
                            <img src={SAMPLE_IMAGE} alt="profile" className="w-14 h-14 rounded-xl object-cover shadow-lg border border-purple-300" />
                        </div>
                    </aside>

                    {/* Main */}
                    <main className="flex-1 px-10 py-10">
                        <header className="flex items-center justify-between mb-6">
                            <h1 className="text-3xl font-black text-purple-800 drop-shadow-sm">My Voice</h1>
                            <button className="bg-purple-700 text-white px-5 py-2 rounded-2xl shadow-lg hover:bg-purple-800 transition-all">+ New Voice</button>
                        </header>

                        <section>
                            <div className="flex gap-4 items-center">
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search voices..."
                                    className="flex-1 border-purple-300 border bg-purple-50/60 backdrop-blur rounded-2xl px-4 py-3 shadow focus:outline-none focus:ring-2 focus:ring-purple-400"
                                />

                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value)}
                                    className="border border-purple-300 bg-purple-50 rounded-xl px-3 py-2 shadow"
                                >
                                    <option value="latest">Latest added</option>
                                    <option value="alpha">A → Z</option>
                                </select>
                            </div>

                            <div className="mt-8 space-y-5">
                                {filtered.map((v) => (
                                    <VoiceCard key={v.id} voice={v} />
                                ))}
                            </div>
                        </section>

                        {/* Footer */}
                        <footer className="fixed left-28 right-8 bottom-6 bg-purple-200/60 backdrop-blur border border-purple-300 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-xl">
                            <button className="w-12 h-12 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-md">▶</button>
                            <div className="flex flex-col">
                                <div className="text-sm font-semibold text-purple-900">Voice model</div>
                                <div className="text-xs text-purple-700">Lorem ipsum dolor sit amet…</div>
                            </div>
                            <div className="flex-1">
                                <div className="h-2 bg-purple-300 rounded-full relative">
                                    <div className="absolute left-0 top-0 h-2 rounded-full bg-purple-700" style={{ width: "55%" }} />
                                </div>
                            </div>
                            <div className="text-xs text-purple-700">00:03 / 00:05</div>
                            <button className="ml-3 p-2 border border-purple-400 rounded-lg bg-purple-50 shadow">⬇</button>
                        </footer>
                    </main>
                </div>
            </div>
            <nav className="flex flex-col items-center gap-6">
                <SidebarButton label="Home" />
                <SidebarButton label="Voice" active />
                <SidebarButton label="Facemotion" />
                <SidebarButton label="My project" />
                <SidebarButton label="Speech maker" />
                <SidebarButton label="Video Generator" />
            </nav>
            <div className="mt-auto">
                <img src={SAMPLE_IMAGE} alt="profile" className="w-12 h-12 rounded-full object-cover shadow" />
            </div>
    
            {/* Main */ }
            <main main className = "flex-1 px-10 py-8" >
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">My Voice</h1>
            <div className="flex items-center gap-3">
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700">+ Create new voice</button>
            </div>
          </header>

          <section className="mt-6">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Voice"
                  className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 bg-purple-50 border rounded-md">🔽</button>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="border rounded-md px-3 py-2">
                  <option value="latest">Latest added</option>
                  <option value="alpha">A - Z</option>
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {filtered.map((v) => (
                <VoiceCard key={v.id} voice={v} />
              ))}
            </div>
          </section>

    {/* Footer audio bar (mimic) */ }
    <footer className="fixed left-24 right-8 bottom-6 bg-purple-50 border rounded-2xl px-4 py-3 flex items-center gap-4 shadow-md">
        <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center">▶</button>
            <div className="flex flex-col">
                <div className="text-sm font-medium">Voice model</div>
                <div className="text-xs text-slate-500">Worem ipsum dolor sit amet, consectetur...</div>
            </div>
        </div>
        <div className="flex-1">
            <div className="h-2 bg-slate-200 rounded-full relative">
                <div className="absolute left-0 top-0 h-2 rounded-full" style={{ width: "60%", backgroundColor: "black" }} />
            </div>
        </div>
        <div className="text-xs text-slate-500">00:03 / 00:05</div>
        <button className="ml-3 p-2 border rounded-md">⬇</button>
    </footer>
        </main >
        </>
    );
}

function SidebarButton({ label, active }: { label: string; active?: boolean }) {
    return (
        <button className={`w-12 h-10 flex items-center justify-center rounded-lg ${active ? "bg-purple-100 text-indigo-600" : "text-slate-400"}`}>
            <span className="text-[10px]">{label}</span>
        </button>
    );
}

function VoiceCard({ voice }: { voice: Voice }) {
    return (
        <div className="flex items-center justify-between border rounded-xl px-4 py-4">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden">
                    <img src={voice.avatarUrl} alt={voice.name} className="w-full h-full object-cover" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{voice.name}</h3>
                        <span className="text-xs bg-black text-white rounded-full px-2 py-1">Personal</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500 flex gap-2 items-center">
                        <Tag text={voice.language} />
                        <Tag text={voice.gender} />
                        {voice.tags.map((t) => (
                            <Tag key={t} text={t} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button className="px-4 py-2 border rounded-md">Use</button>
                <button className="p-2 text-slate-500">⋮</button>
            </div>
        </div>
    );
}

function Tag({ text }: { text: string }) {
    return <div className="text-xs bg-slate-100 px-2 py-1 rounded-full">{text}</div>;
}
