---
{"dg-publish":true,"permalink":"/260813-custom-receiver/","dg-note-properties":{}}
---


#고대구로 #CustomReceiver #폐기능추가파라미터 #테스트 

## 결론
1. CustomReceiver 동작 테스트 완료 
2. 기존 문서 상에 CustomReceiver 동작 workflow 내용 확인 함 
3. 폐기능 관련 추가 파라미터 연동 관련 내용이 뭔지 확인 및 개발 진행필요!

## 결과
1. CustomReceiver Input 수치값은  단 한개만 존재하여 그것으로만 테스트 수행 함 
2. Output Createimage 체크되어 있는데도 이미지 생성은 되지 않는것으로 확인 됨 
3. CustomReceiver 설정에 SotageClient 설정후  Input txt 파일을 넣게 되면  지정된 Storage Volume ID 해당 경로로 XML 파일이 생성되어 있음 
4. 고대 CustomReceiver 관련 workflow 및 CISReceiver Workflow 내용을 문서상으로 확인 하였음
## 진행 내용 
1. CutomReceiver 실행 폴더 및  데이터 수집 진행
	1. 26/08/06 고대 방문 폐기능 검사실 방문 CustomReceiver 폴더 자체 복사
	2. 안산 서버 1호기 D:\CISWorkFolder 파일 옮겨준 CustomReciever 폴더 가져옴
	3. ![Pasted image 20260813110831.png](/img/user/Pasted%20image%2020260813110831.png)
	4. 폐기능 관련 전문의 분이  Data 파일 샘플도 메일로 보내줌
	5. ![Pasted image 20260813110914.png](/img/user/Pasted%20image%2020260813110914.png)
2. CustomReceiver  실행 테스트
	1. C:\Infinitt\CustomReceiverU 경로로 설정
		1. Input 폴더  C:\NETLINK 설정
		2. ![Pasted image 20260813111031.png](/img/user/Pasted%20image%2020260813111031.png)
		3. ![Pasted image 20260813111049.png](/img/user/Pasted%20image%2020260813111049.png)
		4. CSV Parser Setting  Create Image 체크 확인 및 Output, Backup 경로 확인
		5. Extract Data - Map File 관련 내용이 뭔지 확인 필요 !
		6. ![Pasted image 20260813111122.png](/img/user/Pasted%20image%2020260813111122.png)
		7. 메인 화면에서 Settings 클릭 Interface Data가 기존 Storage client 설정됭 있음 확인
		8. Storage Client 설정 내용을  CIS Test Storage Server IP & Port로 변경
			1. External App 설정은 되어 있지 않았음
		9. ![Pasted image 20260813111159.png](/img/user/Pasted%20image%2020260813111159.png)
		10. ![Pasted image 20260813111209.png](/img/user/Pasted%20image%2020260813111209.png)
		11. Volume ID 는 1로 설정 
		12. 아래와 같이 T_VOLUME DB 테이블에  경로 확인 ![Pasted image 20260813111510.png](/img/user/Pasted%20image%2020260813111510.png)
		13. 수치 값 Input 폴더인 C:\NETLINK 에 넣고 동작 확인
		14. 수치값 내용은 아래와 같이 폐기능 관련 CSV 형식의 txt 파일 내용임을 확인 함 
		15. ![Pasted image 20260813111709.png](/img/user/Pasted%20image%2020260813111709.png)
		16. Receiver Start 후  수치 데이터 txt 파일을 Input 폴더에 넣고 로그 확인 
		17. Storage VolumeID 패스에  XML 파일로 생성됨을 확인
		18. ![Pasted image 20260813125644.png](/img/user/Pasted%20image%2020260813125644.png)
		19. ![Pasted image 20260813125709.png](/img/user/Pasted%20image%2020260813125709.png)
		20. ![Pasted image 20260813125749.png](/img/user/Pasted%20image%2020260813125749.png)
		21. ![Pasted image 20260813125821.png](/img/user/Pasted%20image%2020260813125821.png)

3. CustomReceiver 관련 기존 문서 확인
	1. 고대 CISReceiver , CustomReciever 연동 workflow 확인
	2. CISReceiver 연동 방식 
	3. CustomReceiver 연동 방식
	4. ![Pasted image 20260813130059.png](/img/user/Pasted%20image%2020260813130059.png)
	5. 위 두가지 버전에 대하여 폐기능를 이용하는 CustomReciever만 해당되는 것인지 아니면 CISReceiver를 사용하는 것인지  확인 필요 함 ! 

## 향후 진행 검토 항목
1. 폐기능 관련  CIS Applicaiton 이 CustomReceiver로만 사용하는 것인 맞는지 확인 필요 ! 
2. CISReceiver Workflow 방식으로 폐기능 관련 연동을 하는 방식이 있는지 확인 필요 !
3. CustomReceiver 위에 설정화면상에 이해하지 못하는 항목에 대한 분석 
	1. CreateImage 체크 활성화 상태인데  Image 생성이 안되는 것인지 ? 
	2. Extract Data - Map File 에 대한 역할은 무엇인지 ? 
