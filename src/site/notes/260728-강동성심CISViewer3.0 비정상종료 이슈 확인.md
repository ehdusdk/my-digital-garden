---
{"dg-publish":true,"permalink":"/260728-cis-viewer3-0/","dg-note-properties":{}}
---

#강동성심 #CISViewer3 #비정상종료 

[[HIE팀 이슈\|HIE팀 이슈]]
## 이슈 
1. 26/07/27 전달받은 내용으로 CISViewer3.0  EMR SW "KAMIS" 를 통해 외래환자의 CIS 호출하여 CISViewer 3.0 호출 하는데 환자 검사 관련 worklist 리스트에 선택하여 여러 검사 정보 이미지를 확인하는데 갑자기 비정상종료 된다고 함 
2. AI 통해 Log 확인하여 증상 파악 
## 진행 내용 
1. AI 통해 Log 분석하여 EMR 쪽에서  인자값을 부여하는 호출 방식으로 CISVIewer3.0 호출 하는데 관련 의심되는 부분에 대한 로그 보강 함 
2. 병원 정보 링크 
	1. [CIS 병원별 정보 - CIS - INFINITT Redmine](https://src.infinitt.com/projects/cis/wiki/CIS_%EB%B3%91%EC%9B%90%EB%B3%84_%EC%A0%95%EB%B3%B4)
3. 병원정보 링크 확인하여 강동성심병원 CISViewer 3.0 은 ProductDefine.h 에 CIS_PRODUCT_VERSION_3000 으로 변경 버전에 Sprindefine.h는 SPRINT_PROTOCOL_v01000004임을 확인
4. 배포 버전은 아래 캡처 화면 확인 
   ![Pasted image 20260728102000.png](/img/user/Pasted%20image%2020260728102000.png)
   ![Pasted image 20260728101932.png](/img/user/Pasted%20image%2020260728101932.png)
5. 아래 캡처 내용은 빌드 버전 세팅에 대한 캡처 이미지와  검사실에서 CISViewer3.0 호출 방법에 대한 EMR -> CISViewer3.0 호출 -> 검사 이미지 확인 내용 -> 작업관리자 명령파라미터 및  메모리 및 리소스 변화를 확인 함 
6. 약 1시간 정도 확인하였으나 비정상종료 내용 확인을 하지 못함 
7. 검사실 선생님에게 로그 보강한 버전이므로 이후 교수님 진료 시 비정상종료 발생 시 관련 연락을 해달라고 전달 함
![Pasted image 20260728093609.png](/img/user/Pasted%20image%2020260728093609.png)
![Pasted image 20260728093632.png](/img/user/Pasted%20image%2020260728093632.png)![Pasted image 20260728093657.png](/img/user/Pasted%20image%2020260728093657.png)

![Pasted image 20260728093718.png](/img/user/Pasted%20image%2020260728093718.png)

![Pasted image 20260728093739.png](/img/user/Pasted%20image%2020260728093739.png)

![Pasted image 20260728093801.png](/img/user/Pasted%20image%2020260728093801.png)

![Pasted image 20260728093822.png](/img/user/Pasted%20image%2020260728093822.png)

![Pasted image 20260728093847.png](/img/user/Pasted%20image%2020260728093847.png)

![Pasted image 20260728093907.png](/img/user/Pasted%20image%2020260728093907.png)
![Pasted image 20260728094110.png](/img/user/Pasted%20image%2020260728094110.png)
![Pasted image 20260728094155.png](/img/user/Pasted%20image%2020260728094155.png)
![Pasted image 20260728094727.png](/img/user/Pasted%20image%2020260728094727.png)

## 26/7/28 로그 분석
1. ![Pasted image 20260728102303.png](/img/user/Pasted%20image%2020260728102303.png)
2. ![Pasted image 20260728102319.png](/img/user/Pasted%20image%2020260728102319.png)
3. ![Pasted image 20260728102450.png](/img/user/Pasted%20image%2020260728102450.png)
4. ![Pasted image 20260728102605.png](/img/user/Pasted%20image%2020260728102605.png)
