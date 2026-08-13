---
{"dg-publish":true,"permalink":"/260813-custom-receiver/","dg-note-properties":{}}
---


#고대구로 #CustomReceiver #폐기능추가파라미터 #테스트 

> [!info] 상세 분석 노트
> 소스, 로그, Receiver 설정 XML 및 Storage Client 동작을 대조한 상세 검토 내용은 [[260813-고대구로-폐기능-CustomReceiver 검토\|260813-고대구로-폐기능-CustomReceiver 검토]] 참고.

## 분석 반영 업데이트 (2026-08-13)
1. 첨부 Receiver 설정은 **Vendor `CSV` / Modality `CSV(NumericOnly)` / Type `Polling`**으로 확인됨
	1. Receiver XML: `Vendor id="1000"`, `Modality id="1"`, `Type id="8"`
	2. `KUMC-VMAX`는 Receiver 이름 및 Interface Code이며 VYNTUS Modality를 의미하지 않음
2. `Create Image`가 체크되어도 실제 JPG가 생성되지 않는 원인을 소스에서 확인함
	1. 수치 전용 Parser의 Image 생성 함수가 실제 생성 없이 `TRUE`를 반환함
	2. 따라서 로그의 `Create JPG ... Succeed`는 실제 파일 생성 성공을 보장하지 않는 오해성 로그임
	3. 결과 인터페이스 XML도 `Instance type="J"`이지만 `FilePath`는 원본 `.txt`를 가리킴
3. Storage Client 사용 시 지정된 Volume ID에 **인터페이스 결과 XML**이 업로드되는 구조는 정상임
	1. Volume ID는 로컬 경로가 아니라 Storage Server의 논리 볼륨 번호임
	2. MapFile 또는 Receiver 설정 XML 자체가 Volume으로 업로드되는 것은 아님
4. 현재 MapFile 설정은 잘못된 것으로 확인됨
	1. MapFile이 Receiver 설정 XML 자신을 가리키고 있음
	2. Receiver 설정 XML 루트는 `INFINITT_CIS_RECEIVER`이며 MapFile 요구 루트 `CSV_DATA_MAP`과 다름
	3. 정상 MapFile은 일반적으로 `Config\Receiver\*.xml`에 위치해야 함
	4. 경로 수정 전 Extract Data의 `Setting`에서 저장하면 Receiver 설정 XML을 Map 형식으로 덮어쓸 위험이 있음
5. 현재 출력 XML은 폐기능 수치 177개를 포함하지만 검사일이 `1899-12-30`이고 이름·성별 등이 비어 있어 데이터 품질 검증이 추가로 필요함

## 결론
1. CustomReceiver 동작 테스트 진행 
2. 기존 문서 상에 CustomReceiver 동작 workflow 내용 확인 함
3. 기존 받은 CustomReceiver 설정 ( Extract Data - MapFile 설정 잘못되어 있음)
	1. 관련 정상 MapFile 설정후 동작 확인 필요 함
4. 폐기능 관련 추가 파라미터 연동 관련 내용이 뭔지 확인 및 개발 진행필요!
	1. 폐기능 관련  CustomReceiver 가 아닌 CISReceiver 연동하여 구동하는데 폐기능 관련 기능추가가 되어야 하는지 확인 필요 !
	2. (이전 workflow 상에 CustomReceiver가 아닌 CISReceiver workflow가 존재하며 폐기능검사실에 대한 처리가 고대구로에 파라미터만 추가하는것인지 안암, 안산에도 해당되는 것인지 확인 필요 함!)

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
