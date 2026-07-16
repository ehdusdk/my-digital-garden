---
{"dg-publish":true,"permalink":"/iis-receiver/","dg-note-properties":{}}
---

#IIS #IISRECEIVER 
[[매뉴얼/매뉴얼 인덱스\|매뉴얼 인덱스]]
## 핵심내용
1. Default Web Site 에 ISAPI 필터에 가상디렉토리 중에 하나라도 필터를 걸으면 모든 가상디렉토리 에 접근에 문제가 발생 함 
## 관련노트
1. [[이슈/IIS RECEIVER 설정시 주의사항 - Default Web Site ISAPI 필터 적용이슈\|IIS RECEIVER 설정시 주의사항 - Default Web Site ISAPI 필터 적용이슈]]
## 진행항목
1. IIS 관리자 실행
2. IIS 관리자 좌측 사이트 - Default WebSite 마우스 우측 버튼클릭 - 가상디렉토리 추가
3. ![Pasted image 20260715171506.png](/img/user/Pasted%20image%2020260715171506.png)
4. 별칭 및 실제경로를 세팅한다. 
5. 연결계정에 실제 OS 계정 입력 
6. ![Pasted image 20260715171531.png](/img/user/Pasted%20image%2020260715171531.png)
7. ![Pasted image 20260715171605.png\|332](/img/user/Pasted%20image%2020260715171605.png)
8. ![Pasted image 20260715171617.png](/img/user/Pasted%20image%2020260715171617.png)
9. 설정테스트 클릭 확인 하여 결과 확인
10. ![Pasted image 20260715171636.png](/img/user/Pasted%20image%2020260715171636.png)
11. 가상디렉토리 추가 확인 눌러서 가상디렉토리 등록 한다.
12. ![Pasted image 20260715171706.png](/img/user/Pasted%20image%2020260715171706.png)
13. ![Pasted image 20260715171747.png](/img/user/Pasted%20image%2020260715171747.png)
14. 가상디렉토리 추가된 것을 확인
15. 브라우저에서 아래와 같이 경로로 테스트 진행 500 에러 발생할 것이다. 
	1. 가상디렉토리 계정에 대한 보안 권한을 부여해야 함
16. ![Pasted image 20260715171817.png](/img/user/Pasted%20image%2020260715171817.png)
17. 인증 - 마우스 오른쪽 클릭하여 팝업 메세지창에서 사용자 권한 편집 클릭
18. 가상디렉토리로 지정한 폴더 속성 창이 나타남 
19. 보안 탭으로 이동 그룹또는 사용자 이름에 편집눌러서 위에서 등록한 계정의 추가 및 권한을 부여 한다. 
20. ![Pasted image 20260715172027.png](/img/user/Pasted%20image%2020260715172027.png)
21. ![Pasted image 20260715172036.png](/img/user/Pasted%20image%2020260715172036.png)
22. ![Pasted image 20260715172045.png](/img/user/Pasted%20image%2020260715172045.png)
23. 계정 ID 가 Admin 이면 입력하고 확인 
24. 아래와같이 admin 추가되고  모든권한 및 수정 일기 및 실행 권한에 대하여 허용에 체크하고 확인 누른다.
25. ![Pasted image 20260715172113.png](/img/user/Pasted%20image%2020260715172113.png)
26. 아래와같이  admin 의 추가 및 권한내용을 확인하고 확인 누른다.
27. ![Pasted image 20260715172228.png](/img/user/Pasted%20image%2020260715172228.png)
28. 트리 리스트에서 루트 선택 후 ISAPI 및 CGI 제한 클릭
29. ![Pasted image 20260715172634.png](/img/user/Pasted%20image%2020260715172634.png)![Pasted image 20260715172708.png](/img/user/Pasted%20image%2020260715172708.png)
30. 위와 같이  ISAPI 또는 CGI 경로 가상디렉토리로 지정한 곳에 RECEIVER.dll 패스 지정 및 설명은 IISRECEIVER 지정 및 "확장 경로 실행 허용" 체크 후 확인 누른다.
31. ![Pasted image 20260715172816.png](/img/user/Pasted%20image%2020260715172816.png)
32. IISRECEIVER 처리매핑기 열어서 ISAPI-dll 실제 실행 dll 을 선택한다. 
33. ![Pasted image 20260715175036.png](/img/user/Pasted%20image%2020260715175036.png)
34. 위와 같이  가상디렉토리에 해당되는 RECEIVER.dll 등록이 된 것을 확인 
35. 다시 브라우저에서 아래와 같이 URL 넣고 동작되는지 확인
36. ![Pasted image 20260715173207.png](/img/user/Pasted%20image%2020260715173207.png)
37. 위와같이 정상동작됨을 확인할 수 있다.
	1. 단 적용이 바로 안될 경우 아래와 같이 Default Web Site 선택 후 다시시작을 누른다.
		1. 바로 적용이 안될 경우에만 수행한다.
38. 위와 같이 IISRECEIVER2를 만든다.
	1. 단지 IISRECEIVER2가 되는 곳은 IISRECEIVER와 동일하나 폴더가 다른 곳으로 설정
39. ![Pasted image 20260715173415.png](/img/user/Pasted%20image%2020260715173415.png)
40. 위와 같이  경로는 기존 IISRECEIVER와같은 경로가 아닌 동일한 구성의 폴더 복사하여 처리 함 
	1. 단 Config 폴더에 Config 파일에 SaveXMLPath에 대한설정을 변경이 필요할 수 있다. 
41. 사용자 지정 설정에서 자격증명 관련 ID, PW 설정한다. 
42. ![Pasted image 20260715173558.png](/img/user/Pasted%20image%2020260715173558.png)
43. ![Pasted image 20260715173608.png](/img/user/Pasted%20image%2020260715173608.png)0 
44. 역시 설정테스트도 눌러서 확인해 본다.
45. ![Pasted image 20260715173633.png](/img/user/Pasted%20image%2020260715173633.png)
46. 마찬가지로 루트 아이템에서 ISAPI 및 CGI 제한에 2번째 추가한 RECEIVER.dll에 대한 경로 및 확장 경로 실행 허용 체크하고 등록하기 위해 확인 누른다.
47. ![Pasted image 20260715173837.png](/img/user/Pasted%20image%2020260715173837.png)
48. 루트폴더에 ISAPI 및 CGI 제한에 IISRECEIVER2에 대한 것도 추가해 준다.
49. ![Pasted image 20260715180626.png](/img/user/Pasted%20image%2020260715180626.png)
50. 브라우저 테스트 
51. ![Pasted image 20260715180713.png](/img/user/Pasted%20image%2020260715180713.png)
52. **!!! 주의사항**
	1. 혹시나 두개의 가상 디레토리가  있는 시점에  Default WebSite에 ISAPI 필터를  IISReciever 두개 중에 한개 dll 경로를 등록시켜 주면 모든 가상 디렉토리 접속에 문제가 생김을 확인 함 !
	2. 아래와 같이 ISAPI 필터를 등록하게 되는순가 모든 가상디렉토리에 문제가 생김을 확인
	3. ![Pasted image 20260715180904.png](/img/user/Pasted%20image%2020260715180904.png)
	4. ![Pasted image 20260715180925.png](/img/user/Pasted%20image%2020260715180925.png)
	5. 브라우저 테스트 ( IISRECEIVER, IISRECEIVER2 모두 실패 됨을 확인)
	6. ![Pasted image 20260715181009.png](/img/user/Pasted%20image%2020260715181009.png)
	7. ![Pasted image 20260715181027.png](/img/user/Pasted%20image%2020260715181027.png)
	8. 애플리케이션으로 가상디렉토리를바꿔도 마찬가지로 연결이 되지 않음 
	9. 아래와같이  Default Web Site - ISAPI 필터 에서 제거시에 정상동작 함
	10. ![Pasted image 20260715181247.png](/img/user/Pasted%20image%2020260715181247.png)
	11. ![Pasted image 20260715181305.png](/img/user/Pasted%20image%2020260715181305.png)
	12. ![Pasted image 20260715181312.png](/img/user/Pasted%20image%2020260715181312.png)
