"""يجمّع مشاهد marketing/video/scenes/s1..s7.png في فيديو عمودي 1080×1920 مع موسيقى.
الاستخدام (من جذر المشروع): python marketing/tools/build_video.py"""
import subprocess, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SC = os.path.join(ROOT, "marketing", "video", "scenes")
OUT = os.path.join(ROOT, "marketing", "video", "bio-ad.mp4")
MUSIC = os.path.join(ROOT, "marketing", "video", "music.wav")
FPS = 30
D = [3.0, 3.4, 3.4, 3.4, 3.4, 3.6, 4.6]  # مدة كل مشهد
T = 0.5  # مدة الانتقال
TRANS = ["smoothup", "slideright", "circleopen", "slideright", "fadewhite", "smoothup"]
total = sum(D) - T * (len(D) - 1)

subprocess.run([sys.executable, os.path.join(ROOT, "marketing", "tools", "music.py"), str(total), MUSIC], check=True)

args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
for i, d in enumerate(D):
    args += ["-loop", "1", "-framerate", str(FPS), "-t", str(d), "-i", os.path.join(SC, f"s{i + 1}.png")]
args += ["-i", MUSIC]

f = []
for i, d in enumerate(D):
    frames = int(d * FPS)
    # زووم بطيء للداخل (أو للخارج في المشاهد الزوجية) — يُكبَّر أولاً لتفادي الاهتزاز
    z = f"1+0.045*on/{frames}" if i % 2 == 0 else f"1.045-0.045*on/{frames}"
    f.append(
        f"[{i}:v]scale=2160:3840,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps={FPS},format=yuv420p,setsar=1[v{i}]"
    )
prev, off = "v0", 0.0
for i in range(1, len(D)):
    off += D[i - 1] - T
    out = f"x{i}" if i < len(D) - 1 else "vout"
    f.append(f"[{prev}][v{i}]xfade=transition={TRANS[i - 1]}:duration={T}:offset={off:.3f}[{out}]")
    prev = out
args += [
    "-filter_complex", ";".join(f),
    "-map", "[vout]", "-map", f"{len(D)}:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-r", str(FPS),
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT,
]
subprocess.run(args, check=True)
print("video ok", f"{total:.1f}s")
