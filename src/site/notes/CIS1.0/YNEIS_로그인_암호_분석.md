---
{"dg-publish":true,"permalink":"/cis-1-0/yneis/","dg-note-properties":{}}
---

#YNEIS #세브란스 #로그인 

[[CIS1.0\|CIS1.0]]
# YNEIS 로그인 및 암호 관련 로직 분석

## 분석 대상

- 실제 확인 경로: `D:\Proj\CIS_ETC\YNEIS`
- 주요 코드 트리:
  - `D:\Proj\CIS_ETC\YNEIS\YNEIS`
  - `D:\Proj\CIS_ETC\YNEIS\YNEIS_INBODY`
  - `D:\Proj\CIS_ETC\YNEIS\Package`

요청 경로로 언급된 `PROJ\ETC\YNEIS`는 현재 워크스페이스에 없었고, 실제 YNEIS 관련 파일은 `CIS_ETC\YNEIS` 아래에서 확인되었다.

## 1. YNEIS 로그인 Workflow

YNEIS의 사용자 로그인은 일반적인 사용자 암호 인증이 아니라, 저장된 또는 입력된 `User_ID`가 유효한지 DB 프로시저로 확인하는 구조이다.

### 1. 프로그램 시작

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\test.cpp`
- 함수: `CTestApp::InitInstance()`
- 핵심 흐름:
  - 실행 파일 위치 기준으로 `SETUP.INI` 경로를 만든다.
  - `DEFAULT/User_Name` 값을 읽는다.
  - `User_Name`이 비어 있으면 `C:\NEIS\NEISSET.exe` 설정 프로그램을 실행한다.

### 2. 메인 다이얼로그 초기화

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 함수: `CTestDlg::OnInitDialog()`
- 핵심 흐름:
  - `SETUP.INI`, `IP.INI`, `Exam_Code.INI`, `XML_CODE.INI`, `Version.INI` 등의 설정 파일 경로를 구성한다.
  - 서버 모드(`SERVER_MODE`)를 읽고 `DEFAULT`, `OPER`, `DEV`, `EDU`, `DR` 중 사용할 설정 섹션을 결정한다.
  - OCS/EMR/FTP/FileServer 접속 정보와 기존 `User_ID`, `User_Name` 등을 읽어 멤버 변수에 저장한다.

### 3. 업데이트 체크 후 로그인 진입

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 함수: `CTestDlg::UPDATE_PROGRAM()`
- 핵심 흐름:
  - 업데이트 체크 옵션이 꺼져 있으면 바로 `InitProgram()`을 호출한다.
  - 업데이트 체크 후 최신 버전이거나 업데이트 파일을 찾지 못한 경우에도 `InitProgram()`으로 진입한다.

### 4. 저장된 User ID 우선 검증

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 함수: `CTestDlg::InitProgram()`
- 핵심 흐름:
  - `CheckLogin(m_eUserID)`를 먼저 호출한다.
  - 기존 `User_ID`가 유효하면 바로 `OnSearch()`를 실행한다.
  - 실패하면 로그인 다이얼로그 `CDlgLogin`을 띄운다.
  - 로그인 다이얼로그에서 `OK`가 반환되면 `OnSearch()`를 실행하고, 취소되면 프로그램 종료 흐름으로 간다.

### 5. User ID 검증

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 함수: `CTestDlg::CheckLogin(CString strID)`
- 핵심 흐름:
  - FileServer DB가 열려 있지 않으면 `DB_FILESERVER_OPEN()`을 호출한다.
  - DB 오픈 실패 시 `Do not DataBase open` 메시지를 표시하고 실패 처리한다.
  - 아래 프로시저를 호출한다.

```sql
{schema}.USP_MR_GEN_ZZ_UserM_SelectUserNm '{UserID}'
```

- 결과 레코드에서 사용자명으로 보이는 필드가 비어 있지 않으면 로그인 성공으로 처리한다.
- 성공 시 `m_eUserID = strID`로 현재 사용자 ID를 갱신한다.

### 6. 로그인 다이얼로그 입력 처리

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\DlgLogin.cpp`
- 함수: `CDlgLogin::OnBtnLogin()`
- 핵심 흐름:
  - `IDC_EDIT_USER_ID` 입력값만 읽는다.
  - ID가 비어 있으면 `Insert User ID!` 메시지를 표시한다.
  - `CheckLogin(strGetID)`를 호출한다.
  - 성공하면 `SETUP.INI`의 `DEFAULT/User_ID`에 입력 ID를 저장하고 로그인 창을 닫는다.
  - 실패하면 `User ID is wrong or Expired. Insert new ID` 메시지를 표시한다.

### 7. 로그인 UI에서 Password 필드 상태

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\test.rc`
- 리소스: `IDD_DLG_LOGIN`
- 확인 내용:
  - `IDC_EDIT_USER_ID`는 활성 입력 필드이다.
  - `IDC_EDIT_USER_PW`는 존재하지만 `WS_DISABLED`가 지정되어 있어 로그인 처리에 사용되지 않는다.

```rc
EDITTEXT IDC_EDIT_USER_ID,32,40,90,12,ES_AUTOHSCROLL
EDITTEXT IDC_EDIT_USER_PW,32,55,90,12,ES_AUTOHSCROLL | WS_DISABLED
```

따라서 YNEIS 실행 로그인은 비밀번호 입력 인증이 아니라 `User_ID` 검증 중심으로 동작한다.

## 2. "사용할 수 없는 암호" 유사 메시지 확인

소스, 설정 파일, 패키지 실행 파일 문자열을 검색한 결과, 아래와 같은 직접 문구는 확인되지 않았다.

- `사용할 수 없는 암호`
- `사용할수 없는 암호`
- `사용 불가 암호`
- `unusable password`
- `not available password`
- `unavailable password`

### 로그인 관련 메시지

#### User ID 미입력

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\DlgLogin.cpp`
- 메시지:

```text
Insert User ID!
```

#### User ID 오류 또는 만료

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\DlgLogin.cpp`
- 메시지:

```text
User ID is wrong or Expired. Insert new ID
```

#### 로그인 화면 안내 문구

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\test.rc`
- 메시지:

```text
User ID is wrong or Expired. Enter a normal ID
```

### 비밀번호 관련 유사 메시지

#### 이미지 수정/저장 기능의 비밀번호 오류

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\PreviewDlg.cpp`
- 함수:
  - `CPreviewDlg::OnRegion()`
  - `CPreviewDlg::OnGotopicture()`
- 메시지:

```text
Need user quotation.
Record and retry password.
```

```text
PassWord is wrong.
```

이 기능에서의 비밀번호 검증은 별도 암호화된 비밀번호가 아니라 아래와 같은 단순 비교이다.

```cpp
if(m_pw == m_UserID)
```

즉, 이미지 수정/저장 보호용 입력값이 현재 `User_ID`와 같아야 통과하는 구조이다. YNEIS 실행 로그인 자체와는 다른 기능이다.

### DB/네트워크 관련 유사 메시지

#### DB 오픈 실패

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 메시지:

```text
Do not DataBase open
```

#### OCS/네트워크 접속 실패

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 메시지:

```text
Do not Access by the problem of OCS SERVER or network.
```

이 메시지들은 직접적인 "사용할 수 없는 암호" 문구는 아니지만, DB/FTP/네트워크 인증 실패 상황에서 사용자에게 보일 수 있는 관련 오류 후보이다.

## 3. 사용자 암호화 관련 로직 확인 결과

사용자 로그인 경로에서 암호화/복호화 로직은 확인되지 않았다.

검색 키워드:

- `Crypt`
- `Crypto`
- `Encrypt`
- `Decrypt`
- `Encode`
- `Decode`
- `Base64`
- `MD5`
- `SHA`
- `DES`
- `AES`
- `RC4`
- `XOR`
- `암호화`
- `복호화`

위 키워드 기준으로 사용자 로그인 암호화 처리로 볼 수 있는 로직은 발견되지 않았다.

## 4. OCS/EMR/FTP 비밀번호 처리

YNEIS에는 사용자 로그인 비밀번호와 별개로 OCS/EMR/FTP/FileServer 접속용 비밀번호가 존재한다.

### 설정 파일 키

대표 키:

- `OCS_server_PW`
- `EMR_server_PW`
- `Network_pw`
- `BNetwork_pw`

확인 위치 예:

- `D:\Proj\CIS_ETC\YNEIS\Package\신촌\신촌_YNEIS_FULL\IP.INI`
- `D:\Proj\CIS_ETC\YNEIS\Package\강남\강남_YNEIS_FULL\IP.INI`
- `D:\Proj\CIS_ETC\YNEIS\Package\YNEIS_UPDATE\IP.INI`
- `D:\Proj\CIS_ETC\YNEIS\YNEIS\Debug\IP.INI`
- `D:\Proj\CIS_ETC\YNEIS\YNEIS\Release\SETUP.INI`

### DB 연결 문자열

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 함수:
  - `DB_OCS_OPEN()`
  - `DB_EMR_OPEN()`
  - `DB_FILESERVER_OPEN()`

연결 문자열은 아래 형식으로 구성된다.

```text
PROVIDER=SQLOLEDB;
SERVER=%s;
Initial Catalog=%s;
User ID=%s;
PWD=%s
```

이때 `PWD=%s`에는 설정 파일에서 읽은 OCS/EMR 비밀번호가 들어간다.

### FTP 연결

- 파일: `D:\Proj\CIS_ETC\YNEIS\YNEIS\testDlg.cpp`
- 함수: `UPDATE_PROGRAM()`

FTP 접속 시 `m_NetID`, `m_NetPW`, `m_NetFD`를 사용한다.

```cpp
m_pConnection = m_Session.GetFtpConnection(m_NetIP, m_NetID, m_NetPW, nPort, bPassive);
```

`m_NetPW`가 비어 있으면 anonymous login 모드로 처리한다.

## 5. 결론

1. YNEIS의 실행 로그인은 사용자 비밀번호 인증이 아니라 `User_ID` 유효성 검증이다.
2. 로그인 다이얼로그에는 PW 입력 필드가 존재하지만 disabled 상태이며, 실제 로그인 로직에서는 사용되지 않는다.
3. 사용자 로그인 경로에서 암호화/복호화 로직은 확인되지 않았다.
4. `사용할 수 없는 암호`와 정확히 일치하거나 직접 대응되는 메시지는 소스/패키지/바이너리 문자열에서 발견되지 않았다.
5. 가장 가까운 메시지는 다음이다.
   - `User ID is wrong or Expired. Insert new ID`
   - `User ID is wrong or Expired. Enter a normal ID`
   - `PassWord is wrong.`
   - `Do not DataBase open`
   - `Do not Access by the problem of OCS SERVER or network.`
6. 세브란스 병원 현장에서 보고된 "사용할 수 없는 암호" 계열 메시지는 YNEIS 자체 로그인 메시지라기보다, SQL Server/OLEDB/FTP/Windows 네트워크 인증 계층에서 발생한 외부 오류 메시지가 YNEIS 실행 중 노출된 것일 가능성이 높다.

## 6. 추가 확인 권장 사항

- 현장 로그 폴더의 YNEIS 로그에서 `DB_OCS_OPEN`, `DB_EMR_OPEN`, `DB_FILESERVER_OPEN`, `UPDATE_PROGRAM`, `CheckLogin` 주변 실패 로그를 확인한다.
- 현장 `IP.INI`의 `OCS_server_PW`, `EMR_server_PW`, `Network_pw`, `BNetwork_pw` 값이 운영 서버 정책에 맞는지 확인한다.
- SQL Server 계정 잠김, 만료, 비밀번호 정책 위반, Windows/FTP 계정 만료 여부를 병원 인프라 담당자와 확인한다.
- "사용할 수 없는 암호" 메시지의 정확한 원문 또는 스크린샷을 확보하면, YNEIS 내부 메시지인지 외부 컴포넌트 메시지인지 더 좁힐 수 있다.
