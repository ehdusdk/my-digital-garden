---
{"dg-publish":true,"permalink":"/utf-16-http-response-analysis/","dg-note-properties":{}}
---

#IISRECEIVER #지피엔피2차요청적용 
[[HIE팀 이슈\|HIE팀 이슈]]
# Philips ECG UTF-16 응답 처리 요청사항 및 분석 내용

## 1. 배경

서울성모 CW5000 Philips ECG 장비로 ISAPI DLL 확장을 통해 응답 XML을 전달하는 과정에서 장비 측 에러가 발생하였다.

Philips 관련 업체인 지피엔피에서 응답 XML 인코딩 처리를 UTF-16 기준으로 맞춰달라는 요청이 있었고, 현재 코드는 이에 따라 응답 XML body를 UTF-16으로 전송하도록 변경된 상태이다.

추가로 지피엔피에서 아래와 같은 요청을 전달하였다.

- HTTP header 쪽에 UTF-16임을 알릴 것
- HTTP body 쪽에 UTF-16임을 알릴 것
- 소켓에서도 UTF-16으로 보내야 하는 설정이 필요하다는 언급

본 문서는 위 요청사항에 대한 현재 코드 기준 분석 내용과 대응 방향을 정리한 것이다.

## 2. 현재 코드의 응답 처리 흐름

응답 처리는 `CIS_ECG_ACCEPT.cpp`의 `Respon_PageWriter(CHttpServerContext *pCtxt)` 함수에서 수행된다.

현재 주요 흐름은 다음과 같다.

1. 응답 XML 문자열을 `WCHAR` 문자열로 구성한다.
2. XML 선언에 `encoding="UTF-16"`을 명시한다.
3. UTF-16 LE BOM인 `FF FE`를 응답 body 앞에 추가한다.
4. `WCHAR` 문자열 길이에 `sizeof(WCHAR)`를 곱해 실제 byte 길이를 계산한다.
5. `pCtxt->m_pECB->WriteClient()`를 통해 IIS로 응답 body byte 배열을 전달한다.
6. IIS가 해당 byte 배열을 실제 HTTP 응답으로 클라이언트 장비에 전송한다.

현재 body 전송 관련 핵심 코드는 다음 형태이다.

```cpp
const WCHAR* responsexml =
    L"<?xml version=\"1.0\" encoding=\"UTF-16\" standalone=\"no\" ?>\r\n"
    L"<response xmlns=\"http://www3.medical.philips.com\">\r\n"
    ...
    L"</response>\r\n";

BYTE bom[2] = { 0xFF, 0xFE };   // UTF-16 LE BOM

DWORD xmlByteLength = (DWORD)(wcslen(responsexml) * sizeof(WCHAR));
DWORD MsgToClntLengt = sizeof(bom) + xmlByteLength;

BYTE* MsgToClnt = new BYTE[MsgToClntLengt];

memcpy(MsgToClnt, bom, sizeof(bom));
memcpy(MsgToClnt + sizeof(bom), responsexml, xmlByteLength);

pCtxt->m_pECB->WriteClient(
    pCtxt->m_pECB->ConnID,
    MsgToClnt,
    &MsgToClntLengt,
    NULL
);
```

Windows C++ 환경에서 `WCHAR`는 일반적으로 UTF-16 Little Endian 2 byte 문자이므로, 위 방식은 UTF-16 LE byte stream을 생성하여 전송하는 구조이다.

## 3. HTTP header 쪽 UTF-16 명시 의미

지피엔피에서 말한 "head 쪽에 UTF-16임을 알린다"는 것은 HTTP 응답 header의 `Content-Type`에 charset을 명시하라는 의미로 판단된다.

예상되는 header는 다음과 같다.

```http
Content-Type: text/xml; charset=UTF-16
```

또는 XML 응답임을 더 명확히 하려면 다음도 가능하다.

```http
Content-Type: application/xml; charset=UTF-16
```

현재 프로젝트의 `afxisapi.h`에 있는 `CHttpServerContext` / `CHttpServer` 호환 래퍼에는 charset을 설정하는 전용 메소드가 없다.

확인된 기존 메소드는 다음 정도이다.

```cpp
void StartContent(CHttpServerContext* pCtxt)
{
    if (pCtxt != NULL)
        *pCtxt << _T("Content-Type: text/html\r\n\r\n");
}
```

하지만 실제 `Respon_PageWriter()` 응답 흐름에서는 `StartContent()`를 사용하지 않고, 직접 `WriteClient()`로 body를 전송하고 있다.

따라서 HTTP header에 UTF-16 charset을 알리려면 ISAPI 원 API인 `ServerSupportFunction()`을 직접 호출하는 방식이 적절하다.

## 4. HTTP header 추가 방식

`WriteClient()`로 UTF-16 body를 전송하기 전에 `ServerSupportFunction()`을 호출하여 HTTP 응답 header를 먼저 전송한다.

예상 코드는 다음 형태이다.

```cpp
HSE_SEND_HEADER_EX_INFO HeaderExInfo;

const char* pszStatus = "200 OK";
const char* pszHeader =
    "Content-Type: text/xml; charset=UTF-16\r\n"
    "Cache-Control: no-cache\r\n"
    "\r\n";

HeaderExInfo.pszStatus = pszStatus;
HeaderExInfo.pszHeader = pszHeader;
HeaderExInfo.cchStatus = strlen(pszStatus);
HeaderExInfo.cchHeader = strlen(pszHeader);
HeaderExInfo.fKeepConn = FALSE;

pCtxt->m_pECB->ServerSupportFunction(
    pCtxt->m_pECB->ConnID,
    HSE_REQ_SEND_RESPONSE_HEADER_EX,
    &HeaderExInfo,
    NULL,
    NULL
);

// 이후 기존 UTF-16 BOM + XML body 전송
pCtxt->m_pECB->WriteClient(
    pCtxt->m_pECB->ConnID,
    MsgToClnt,
    &MsgToClntLengt,
    NULL
);
```

중요한 점은 HTTP header 자체를 UTF-16으로 보내는 것이 아니라는 점이다.

HTTP header는 ASCII/ANSI 문자열로 작성하고, 그 안의 `charset=UTF-16` 값을 통해 body 인코딩이 UTF-16임을 알려야 한다.

## 5. 기존 `dwHttpStatusCode = HTTP_STATUS_OK`와의 관계

현재 코드에는 다음 로직이 있다.

```cpp
pECB->dwHttpStatusCode = HTTP_STATUS_OK;
```

이 코드는 HTTP 응답 상태 코드가 성공이라는 값을 설정하는 역할이다.

반면 아래 header는 응답 body의 MIME type과 문자 인코딩을 알려주는 역할이다.

```http
Content-Type: text/xml; charset=UTF-16
```

따라서 `pECB->dwHttpStatusCode = HTTP_STATUS_OK;`가 기존에 있어도, `ServerSupportFunction(..., HSE_REQ_SEND_RESPONSE_HEADER_EX, ...)`로 `Content-Type` header를 추가하는 것은 역할이 다르므로 함께 사용할 수 있다.

단, 상태 코드 값은 서로 일치해야 한다.

```cpp
pECB->dwHttpStatusCode = HTTP_STATUS_OK; // 200
const char* pszStatus = "200 OK";        // 200
```

위처럼 둘 다 200 OK이면 문제 없다.

## 6. HTTP body 쪽 UTF-16 명시 의미

지피엔피에서 말한 "body 쪽에 UTF-16임을 알린다"는 것은 다음 두 가지로 해석된다.

1. XML 선언부에 UTF-16 인코딩 명시
2. 실제 body byte가 UTF-16이어야 함

현재 코드는 아래 선언을 포함하고 있다.

```xml
<?xml version="1.0" encoding="UTF-16" standalone="no" ?>
```

또한 body 앞에 UTF-16 LE BOM을 추가하고 있다.

```cpp
BYTE bom[2] = { 0xFF, 0xFE };
```

그리고 실제 XML 문자열도 `WCHAR` 기반으로 생성하여 byte 배열로 복사하므로, body 쪽 UTF-16 대응은 이미 되어 있는 것으로 판단된다.

정리하면 body 쪽 UTF-16 대응은 다음 조건을 만족한다.

- XML declaration: `encoding="UTF-16"`
- BOM: `FF FE`
- Payload byte: UTF-16 LE byte stream

## 7. 소켓에서도 UTF-16 설정이 필요하다는 언급에 대한 분석

지피엔피에서 추가로 "소켓에서도 UTF-16으로 보내야 하는 것을 설정할 필요가 있다"고 언급했으나, 현재 코드 기준으로 이 표현은 기술적으로 다소 모호하다.

일반 TCP socket 자체에는 "UTF-16으로 설정"하는 옵션이 없다.

소켓은 문자열을 이해하지 않고 byte 배열만 전송한다. 즉, UTF-8인지 UTF-16인지는 소켓 옵션으로 정하는 것이 아니라, 소켓으로 넘기는 byte 배열이 어떤 인코딩으로 만들어졌는지에 따라 결정된다.

현재 프로젝트에서 별도의 Winsock `socket()`, `send()`, `CSocket`, `CAsyncSocket` 등을 사용하여 직접 전송하는 코드는 확인되지 않았다.

현재 응답 전송 경로는 다음과 같다.

```text
CIS_ECG_ACCEPT.dll
 -> pCtxt->m_pECB->WriteClient(MsgToClnt)
 -> IIS
 -> TCP socket
 -> Philips ECG 장비
```

따라서 현재 ISAPI DLL 기준으로 "소켓에서도 UTF-16으로 보내야 한다"는 말은 별도 socket 옵션 설정이 아니라, 최종적으로 `WriteClient()`에 넘기는 `MsgToClnt` byte 배열이 UTF-16이어야 한다는 의미로 해석하는 것이 타당하다.

현재 코드는 `MsgToClnt`를 UTF-16 LE BOM + UTF-16 LE XML byte 배열로 구성하고 있으므로, IIS가 이 byte 배열을 그대로 소켓으로 전송하면 소켓으로 나가는 payload 역시 UTF-16 byte stream이다.

## 8. 지피엔피에 확인할 질문

지피엔피에 아래와 같이 확인하는 것이 좋다.

```text
현재 ISAPI DLL에서는 별도 Winsock socket/send를 사용하지 않고 IIS의 WriteClient로 응답 body byte를 전달합니다.

HTTP Header에는 Content-Type: text/xml; charset=UTF-16을 추가했고,
Body는 UTF-16 LE BOM + XML 선언 encoding="UTF-16" + UTF-16 LE byte 배열로 전송합니다.

말씀하신 "소켓에서도 UTF-16 설정"이 이 payload byte를 UTF-16으로 보내라는 의미가 맞는지 확인 부탁드립니다.

별도 TCP socket 옵션을 의미하신 것이라면 구체적인 설정 항목명 또는 예시 코드를 알려주십시오.
```

## 9. 최종 정리

현재 요청사항은 다음과 같이 대응하면 되는 것으로 판단된다.

| 요청사항 | 의미 | 현재/예상 대응 |
| --- | --- | --- |
| HTTP header에 UTF-16 명시 | `Content-Type` charset 명시 | `Content-Type: text/xml; charset=UTF-16` |
| HTTP body에 UTF-16 명시 | XML declaration 및 실제 body 인코딩 | `encoding="UTF-16"` + `FF FE` BOM + UTF-16 LE byte |
| 소켓에서도 UTF-16 설정 | 별도 socket 옵션이 아니라 payload byte 인코딩으로 해석 | `WriteClient()`에 UTF-16 byte 배열 전달 |

결론적으로 현재 구조에서 추가해야 할 핵심은 HTTP header의 `Content-Type` charset 명시이며, body 및 socket payload 관점에서는 UTF-16 LE byte stream을 보내고 있으므로 방향은 맞다.

다만 지피엔피가 말한 "소켓 설정"이 특정 장비/라이브러리/프로토콜 옵션을 의미하는 것이라면, 구체적인 옵션명 또는 예시 코드를 받아야 정확히 판단할 수 있다.

## 10. curl 테스트 중 404 응답 발생 건

초기 curl 테스트에서 저장된 `response_260703.xml` 파일을 확인한 결과, UTF-16 XML 응답이 아니라 IIS가 생성한 404 HTML 오류 페이지가 저장되어 있었다.

확인된 주요 내용은 다음과 같다.

```text
HTTP 오류 404.0 - Not Found
모듈: IIS Web Core
알림: MapRequestHandler
처리기: StaticFile
오류 코드: 0x80070002
요청한 URL: http://10.10.203.182:80/receiver/receiver.dll
실제 경로: C:\inetpub\wwwroot\receiver\receiver.dll
```

이 응답은 DLL 내부 UTF-16 처리 문제가 아니라, 요청 URL이 실제 ISAPI DLL까지 도달하지 못한 IIS 경로 또는 매핑 문제로 판단된다.

초기 요청 URL은 다음 형태였다.

```text
http://10.10.203.182/receiver/receiver.dll
```

이후 정상 동작한 요청 URL은 다음 형태이다.

```text
http://10.10.203.182/IISReceiver/receiver.dll
```

따라서 404 발생 시에는 UTF-16 응답 로직보다 먼저 IIS virtual directory/application 경로, DLL 파일명, Handler Mapping, ISAPI and CGI Restrictions 설정을 확인해야 한다.

## 11. 정상 동작 확인 결과

올바른 URL로 curl 테스트를 수행한 결과, ISAPI DLL까지 요청이 정상 도달했고 HTTP 200 OK 응답이 확인되었다.

curl verbose 출력에서 확인된 주요 응답 header는 다음과 같다.

```http
HTTP/1.1 200 OK
Cache-Control: no-cache
Content-Type: text/xml; charset=UTF-16
Server: Microsoft-IIS/10.0
Connection: close
Content-Length: 744
```

위 결과로 볼 때 다음 사항이 확인된다.

- 요청이 IIS의 ISAPI DLL까지 정상 도달하였다.
- 서버 응답 상태가 `HTTP/1.1 200 OK`이다.
- 응답 header에 `Content-Type: text/xml; charset=UTF-16`이 정상 포함되었다.
- 응답 body가 내려왔으며 `Content-Length: 744`로 byte 길이가 명시되었다.

즉, HTTP header에 UTF-16임을 알리는 처리는 정상 적용된 것으로 판단된다.

## 12. curl 테스트 명령 및 의미

테스트에 사용한 curl 명령은 다음 형태이다.

```powershell
curl.exe --http0.9 -v "http://10.10.203.182/IISReceiver/receiver.dll" `
  -H "Content-Type: text/xml; charset=utf-16" `
  --data-binary "@D:\Test\CIS_ECG_ACCEPT\test-c35.xml" `
  --output D:\Test\CIS_ECG_ACCEPT\response_260703.xml
```

각 옵션의 의미는 다음과 같다.

| 옵션 | 의미 |
| --- | --- |
| `-v` | 요청/응답 header 및 송수신 과정을 콘솔에 출력 |
| `-H "Content-Type: text/xml; charset=utf-16"` | 클라이언트가 서버로 보내는 요청 body의 Content-Type 지정 |
| `--data-binary "@...xml"` | XML 파일을 변환 없이 binary 그대로 POST body로 전송 |
| `--output ...` | 서버 응답 body를 지정한 파일로 저장 |

주의할 점은 curl의 `-H "Content-Type: ..."` 옵션은 클라이언트 요청 header를 지정하는 것이며, 서버 응답 header를 강제로 변경하는 옵션은 아니다.

서버 응답 header의 `Content-Type: text/xml; charset=UTF-16`은 ISAPI DLL 코드에서 `ServerSupportFunction(..., HSE_REQ_SEND_RESPONSE_HEADER_EX, ...)`를 통해 내려준 값이다.

## 13. 응답 body UTF-16 확인 방법

curl 결과에서 header는 정상 확인되었으므로, 추가로 응답 파일의 실제 body byte가 UTF-16 LE BOM으로 시작하는지 확인하면 body 쪽 검증도 가능하다.

PowerShell에서 다음 명령으로 확인할 수 있다.

```powershell
Format-Hex "D:\Test\CIS_ECG_ACCEPT\response_260703.xml" | Select-Object -First 5
```

응답 파일의 시작 byte가 다음과 같으면 UTF-16 LE BOM이 포함된 것이다.

```text
FF FE
```

그리고 그 뒤에 XML 선언 문자열이 UTF-16 LE 형태로 나타나면 정상이다.

예상되는 byte 패턴은 다음과 같다.

```text
FF FE 3C 00 3F 00 78 00 6D 00 6C 00
```

이는 다음 문자열을 UTF-16 LE로 인코딩한 형태이다.

```xml
<?xml
```

따라서 최종 검증 기준은 다음과 같다.

| 검증 항목 | 정상 기준 |
| --- | --- |
| HTTP 상태 코드 | `HTTP/1.1 200 OK` |
| 응답 Content-Type | `Content-Type: text/xml; charset=UTF-16` |
| 응답 body 시작 byte | `FF FE` |
| XML 선언 | `<?xml version="1.0" encoding="UTF-16" ... ?>` |

## 14. 404와 UTF-16 오류의 구분

이번 테스트에서 확인된 중요한 점은 404 오류와 UTF-16 처리 오류를 분리해서 봐야 한다는 것이다.

404 오류가 발생하는 경우:

```text
HTTP/1.1 404 Not Found
IIS Web Core
MapRequestHandler
StaticFile
```

이 경우는 ISAPI DLL 코드가 실행되지 않은 상태이므로, UTF-16 header/body 코드와 직접 관련이 없다.

반면 정상적으로 DLL이 실행되는 경우:

```text
HTTP/1.1 200 OK
Content-Type: text/xml; charset=UTF-16
Content-Length: ...
```

이 경우부터 ISAPI DLL의 UTF-16 응답 처리를 검증할 수 있다.

현재 정상 테스트 결과에서는 `HTTP/1.1 200 OK` 및 `Content-Type: text/xml; charset=UTF-16`이 확인되었으므로, header 처리까지는 정상 적용된 것으로 판단된다.