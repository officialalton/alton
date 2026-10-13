// AP 생성 스크립트가 쓰는 Python 경로 단일 출처. 우선순위: AP_PY 환경 변수 → 저장소 로컬 .venv-ap → (구) 임시 venv.
// 설정 절차: python3 -m venv .venv-ap && .venv-ap/bin/pip install -r scripts/ap-generation/requirements.txt
import { existsSync } from "node:fs";
import path from "node:path";
const local = path.resolve(__dirname, "../../.venv-ap/bin/python");
export const AP_PYTHON: string = process.env.AP_PY ?? (existsSync(local) ? local : "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python");
