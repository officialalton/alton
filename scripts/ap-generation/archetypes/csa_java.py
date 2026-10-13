"""AP Computer Science A 코드 우선 검증기(2026-10-13, P0 무료 엔지니어링).
모든 문항의 정답은 **실제로 javac 로 컴파일하고 java 로 실행한 결과**다. LLM 은 정답을 정하지 않는다.
- JDK: 환경변수 CSA_JAVA_HOME → /opt/homebrew/opt/openjdk@21 → PATH(java/javac). 시스템 설정은 건드리지 않는다.
- 작업 폴더: CSA_WORKDIR 또는 임시 폴더(<tmp>/alton-csa-java). 내용 해시로 폴더를 만들고 결과를 캐시한다(결정적 — 같은 소스 → 같은 결과).
- 제한: 컴파일 30초·실행 10초 제한 시간, 프로세스 그룹 통째 종료, RLIMIT_CPU·FSIZE·NOFILE, JVM -Xmx128m -Xss1m, 출력 64KB 상한, 환경변수 최소화(HOME=작업 폴더), 생성 소스에 위험 API 정적 금지.
  (macOS 에서는 RLIMIT_AS 가 신뢰할 수 없어 쓰지 않는다. 생성 코드는 우리 템플릿이지 학생 코드가 아니다 — 학생 답안 실행은 이 파일의 범위가 아니다.)"""
import hashlib, json, os, re, resource, shutil, signal, subprocess, tempfile
from dataclasses import dataclass

JAVA_HOME = next((h for h in (os.environ.get("CSA_JAVA_HOME"), "/opt/homebrew/opt/openjdk@21") if h and os.path.exists(os.path.join(h, "bin", "javac"))), None)
WORK = os.environ.get("CSA_WORKDIR") or os.path.join(tempfile.gettempdir(), "alton-csa-java")
COMPILE_TIMEOUT, RUN_TIMEOUT, MAX_OUT = 30, 10, 64 * 1024
FORBIDDEN = re.compile(r"System\s*\.\s*exit|Runtime\b|ProcessBuilder|java\s*\.\s*(io|net|nio)\b|\bThread\b|\bClassLoader\b|java\.lang\.reflect|\bUnsafe\b|System\s*\.\s*(setProperty|getenv|load)")
DEFAULT_IMPORTS = "import java.util.*;\n"


def java_available():
    return JAVA_HOME is not None or (shutil.which("javac") is not None and shutil.which("java") is not None)


def _tool(name):
    return os.path.join(JAVA_HOME, "bin", name) if JAVA_HOME else shutil.which(name)


def _env(home):
    e = {"PATH": "/usr/bin:/bin", "HOME": home, "LANG": "C.UTF-8"}
    if JAVA_HOME:
        e["JAVA_HOME"] = JAVA_HOME
    return e


def _limits():
    resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
    resource.setrlimit(resource.RLIMIT_FSIZE, (4 << 20, 4 << 20))
    resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))


def _run(cmd, cwd, timeout):
    p = subprocess.Popen(cmd, cwd=cwd, env=_env(cwd), stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, preexec_fn=_limits)
    try:
        out, err = p.communicate(timeout=timeout)
        return p.returncode, out[:MAX_OUT].decode("utf-8", "replace"), err[:MAX_OUT].decode("utf-8", "replace"), False
    except subprocess.TimeoutExpired:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        p.communicate()
        return -9, "", "", True


@dataclass
class JavaResult:
    compiled: bool
    stdout: str
    stderr: str
    timed_out: bool = False
    compile_error: str = ""


def run_java(files, main="Main", cache=True):
    """files: {"Main.java": source, ...}. 컴파일 후 main 클래스를 실행한다. 결과는 내용 해시로 캐시한다."""
    if not java_available():
        raise RuntimeError("no_jdk")
    for name, src in files.items():
        if FORBIDDEN.search(src.replace(_HELPERS, "")):
            raise ValueError(f"forbidden_api_in_generated_source:{name}")
    key = hashlib.sha256(json.dumps([sorted(files.items()), main], sort_keys=True).encode()).hexdigest()[:24]
    d = os.path.join(WORK, key)
    cached = os.path.join(d, "result.json")
    if cache and os.path.exists(cached):
        with open(cached) as fh:
            return JavaResult(**json.load(fh))
    os.makedirs(os.path.join(d, "out"), exist_ok=True)
    for name, src in files.items():
        with open(os.path.join(d, name), "w", encoding="utf-8") as fh:
            fh.write(src)
    rc, _o, e, to = _run([_tool("javac"), "-proc:none", "-Xlint:none", "-encoding", "UTF-8", "-d", "out", *files.keys()], d, COMPILE_TIMEOUT)
    if to or rc != 0:
        res = JavaResult(False, "", "", to, (e or "compile timeout")[:4000])
    else:
        rc, o, e, to = _run([_tool("java"), "-Xmx128m", "-Xss1m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-cp", "out", main], d, RUN_TIMEOUT)
        res = JavaResult(True, o, e, to or rc != 0 and not o)
    with open(cached, "w") as fh:
        json.dump(res.__dict__, fh)
    return res


def compiles(source, name="Main"):
    """한 파일이 컴파일되는지(컴파일 오류 문항의 정답 검증용). 반환: (bool, 컴파일러 메시지)."""
    cls = re.search(r"public\s+(?:final\s+)?class\s+(\w+)", source)
    if not cls:
        source = source + f"\nclass {name}Holder {{}}\n"
    r = run_java({f"{cls.group(1) if cls else name}.java": source}, main=cls.group(1) if cls else f"{name}Holder")
    return r.compiled, r.compile_error


_HELPERS = """
  static String s(Object o) {
    if (o instanceof int[]) return Arrays.toString((int[]) o);
    if (o instanceof double[]) return Arrays.toString((double[]) o);
    if (o instanceof boolean[]) return Arrays.toString((boolean[]) o);
    if (o instanceof String[]) return Arrays.toString((String[]) o);
    if (o instanceof int[][]) return Arrays.deepToString((int[][]) o);
    if (o instanceof String[][]) return Arrays.deepToString((String[][]) o);
    return String.valueOf(o);
  }
  static String run(java.util.function.Supplier<Object> f) {
    java.io.PrintStream old = System.out;
    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
    System.setOut(new java.io.PrintStream(bo));
    Object r;
    String exc = "";
    try { r = f.get(); } catch (Throwable t) { r = null; exc = "EXC:" + t.getClass().getSimpleName(); }
    System.out.flush();
    System.setOut(old);
    return bo.toString() + (r != null ? "=>" + s(r) : "") + exc;
  }
"""


def build_main(classes, bodies, imports=DEFAULT_IMPORTS):
    """classes: 패키지 전용 클래스들의 소스(화면에 보이는 코드 + 보조·변형 클래스). bodies: [("ret"|"out", 문장 본문)].
    ret 본문은 return 으로 값을 돌려주고, out 본문은 출력만 한다(끝에 return null 을 붙인다). 각 본문의 결과 문자열은 'printed=>value' 꼴(예외는 EXC:이름)."""
    parts = []
    for i, (kind, body) in enumerate(bodies):
        tail = "return null;" if kind == "out" else ""
        parts.append(f'    System.out.println("<<R{i}>>" + run(() -> {{ {body}\n {tail} }}) + "<<E>>");')
    main = "public class Main {\n" + _HELPERS + "  public static void main(String[] args) {\n" + "\n".join(parts) + "\n  }\n}\n"
    return imports + classes + "\n" + main


def java_eval(classes, bodies, imports=DEFAULT_IMPORTS):
    """본문마다 실행 결과 문자열 목록을 돌려준다. 컴파일 실패·시간 초과는 ValueError(시드를 버린다)."""
    r = run_java({"Main.java": build_main(classes, bodies, imports)})
    if not r.compiled:
        raise ValueError("java_compile_failed:" + r.compile_error[:300])
    if r.timed_out:
        raise ValueError("java_timeout")
    out = {int(m.group(1)): m.group(2) for m in re.finditer(r"<<R(\d+)>>(.*?)<<E>>", r.stdout, re.S)}
    if len(out) != len(bodies):
        raise ValueError("java_missing_output")
    return [out[i] for i in range(len(bodies))]


def tidy(s):
    """결과 문자열을 선택지용으로 다듬는다: 출력의 줄바꿈은 공백 하나로, 'printed=>value' 는 value 만(둘 다면 둘 다)."""
    s = s.strip("\n")
    if "=>" in s:
        a, b = s.split("=>", 1)
        return (a.strip("\n").replace("\n", " ") + " " + b).strip() if a.strip() else b
    return s.replace("\n", " ").strip()


def spaced_ok(vals, rel=0.08):
    """수치 선택지 간격: 정수가 아닌 값은 서로 상대 8% 이상(소수 반올림으로 흐려지지 않게), 정수는 서로 달라야 하고 정수 값 둘의 차가 1 이면 큰 쪽의 8% 이상이 아니어도 허용하지 않는다 — 단 둘 다 |값| <= 12 이면 정확 정수 구별이라 허용한다."""
    for i in range(len(vals)):
        for j in range(i + 1, len(vals)):
            a, b = vals[i], vals[j]
            if a == b:
                return False
            both_int = float(a).is_integer() and float(b).is_integer()
            if both_int and max(abs(a), abs(b)) <= 12:
                continue
            if abs(a - b) < rel * max(abs(a), abs(b)):
                return False
    return True
