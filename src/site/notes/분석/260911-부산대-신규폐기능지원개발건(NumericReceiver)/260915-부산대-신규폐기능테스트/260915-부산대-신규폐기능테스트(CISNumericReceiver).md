---
{"dg-publish":true,"permalink":"//260911-numeric-receiver/260915/260915-cis-numeric-receiver/","dg-note-properties":{"permalink":"busan_hosp-new_lung_exam_parameter-test_result-CISNumberReceiver"}}
---

#부산대 #신규폐기능 #NumericReceiver #검증 

## 결과
1. New 폐기능 장비 샘플 케이스별 동작 확인 완료!!!
2. 배포 파일 내용 정리 
3. 09/29(화) 신규 장비 연동 테스트 지원 예정
## 테스트 방법
1. 요약
	1. fake NumericSite 설정 및 실행
	2. CISNumericReciever 설정 및 실행
		1. 테스트 환경
			1. ![Pasted image 20260915133706.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915133706.png)
			   ![Pasted image 20260915133754.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915133754.png)
		2. CIS_ETC\CISNumericReceiver\Bin\Win32\Release\(빌드 된 바이너리 파일 구성)
		3. Test 폴더에 설정관련 패스 관련 폴더 세팅 
	3. 케이스 별 데이터 Input 
	4. CISNumericReciever 로그 확인 및 결과 내용 설명
2. fake NumericSite 설정 및 실행
	1. AI 통한 NumericSite Fake 서버
		1. 파이선 파일
			1. 코드상에 (아래 py 파일 참조) srv.bind(("127.0.0.1", 5542)); srv.listen(5) 부분에 IP, Port 번호를 변경 필요시 변경 후 저장
			2. cmd 콘솔이나 powershell 에서 아래와 같이 진행 
				1. python -u fake_numericsite.py
			3. 콘솔화면에서 실행하면 아래와같이 CISNumericSite 요청에 대한 로그가 남게 된다.
			4. ![Pasted image 20260915134544.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915134544.png)
			5. ![[fake_numericsite.py]]
		2. ip, port 에대한 파이선 파일에 내용 변경 후 실행 
		3. 실행 방법
		4. 실행
3. CISNumericReceiver 설정 및 실행 
	1. 구성
		1. 폴더 구성 위 요약 캡처 내용 참조
		2. Test 폴더와 같이 특정 패스에 대한 경로 디렉토리를 생성해 놓는다. 
		3. ![Pasted image 20260915133754.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915133754.png)
		4. CISNumericReceiver 에 인자값 "-console" 주고 실행 
			1. cmd 창에서 실행 
			2. ![Pasted image 20260915134826.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915134826.png)
			3. ![Pasted image 20260915134856.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915134856.png)
			4. 설정 내용 확인 
				1. 실제 설정 파일
					1. Config\setting.ini
						1. 부산대 배포시에는 부산대 setting.ini 그대로 이용 한다!
						2. 테스트 시에는 아래와같이 백업 경로 및 fake NumericSite IP/Port, RetryConunt,  AutoStart, LogLevel, 에 대하여 설정 되어 있음 
						3. CallApp, ExternalApp 관련 세팅은 부산대 세팅을 그대로 배포시에 사용해야 함! ( NEISMIX 호출 할것이라 예상)
						4. 
					2. Map\DataMap.xml
						1. 기존 폐기능 관련 파싱규칙 세팅을 위한 xml 파일
						2. 신규 페기능관련 파싱규칙을 추가 함
						3. 
					3. Receiver\PNUH_ReleaseTest.xml
					4. 샘플파일
						1. PNUH_ReleaseTest.xml
							1. 테스트를 위한 Receiver 설정 파일 
							2. ![[PNUH_ReleaseTest.xml]]
						2. DataMap.xml
							1. 기존 SVN DataMap.xml + 신규 폐기능 관련 적용 파싱 정보 추가 
							2. ![[DataMap - 260915-신규폐기능파싱규칙추가.xml]]
						3. setting.ini![[setting.ini]]
						4. 설정 캡처 이미지 (CISNumericReceiver)
							1. Setting.ini 관련 설정 UI
							2. ![Pasted image 20260915141619.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915141619.png)
							3. Receiver 설정 UI![Pasted image 20260915141513.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915141513.png)
							4. DataMap.xml 설정 ( 기존 파일 확인 및 테스트 , 신규 파일 생성 진행할 수 있음)
							5. ![Pasted image 20260915141759.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915141759.png)
		5. 
	2. DataMap.xml 파일 설명
		1. Input으로 들어오는 PDF or TXT 파일에 대한 파싱 규칙을 세팅하는 map 파일
		2. 아래와 같이 다이얼그에서 DataMap 파일 불러오고 Test Txt 파일을 선택해서 제대로 가져오는지 체크 가능 
		3. DataMap.xml 세팅 내용에 대한 설명 내용 캡처 (CIS_Etc\CISNumericReceiver\Doc\개발 노트.pptx 참조)
			1. ![개발노트.pptx](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/%EA%B0%9C%EB%B0%9C%EB%85%B8%ED%8A%B8.pptx)
	3. 설정 내용 설명
		1. 위에 추가 skip
	4. 실행 방법
		1. "-console" 인자값을 추가하여 cmd 창에서 실행 ( 위에 언급되어 있어서 skip)
4. 케이스 샘플 파일 Input
	1. 확인 사항
		1. Fake NumericSite 화면
			1. 캡처 이미지
			2. ![Pasted image 20260915142646.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915142646.png)
			3. 캡처 내용설명
				1. fake NumericSite listening on 127.0.0.1:5542 (CISCRC compatible, badcrc=False) 로그 메세지 이후에 넘어오는값은 시간별 data=[\~\~\~]값은 CISNumberReceiver -> 실제 NumericSite에 넘겨주는 파라미터 값으로 "파라미터^값" 형식으로 붙여서 보내게 됨
				2. 실제 NumericSite 로그에서 파라미터 내용을 확인볼수 있을꺼라 예상됨
		2. CISNumericReceiver 로그 및 생성 파일 설명
			1. 26/09/15 log 파일 
			2. ![[CISNumericReceiver_20260915.log]]
			3. 설명
				1. Patinet ID(0982) Type(PFTPROVO), Message(PD_FEV^negative)
					1. 기관지 검사 FEV 값 negative 관련 전송 로그
				2. Patinet ID(0982) Type(PFTPROVO), Message(PD_FEV^544)
					1. 기관지 검사 FEV 값 544 값 전송 로그
				3. Patinet ID(0982) Type(PFTPROVO), Message(PD_FEV^negative)
					1. 기관지 검사 FEV 값 544 값 전송 로그
				4. Patinet ID(0982) Type(PFTPROVO), Message(PD_FEV^11.0)
					1. 기관지 검사 FEV 값 11.0 값 전송 로그
				5. Patinet ID(09821) Type(PFTSPIR), Message(FVC_Ref^5.43^FVC_Pre^5.41^FVC_Pref^100^FVC_POST^^FVC_Pref2^^FVC_Pchg^^Fev1_Ref^4.49^Fev1_Pre^4.63^Fev1_Pref^103^Fev1_Post^^Fev1_Pref2^^Fev1_Pchg^^Fef_Ref^4.89^Fef_Pre^5.08^Fef_Pref^104^Fef_Post^^Fef_Pref2^^Fef_Pchg^^PEF_Ref^10.07^PEF_Pre^10.50^PEF_Pref^104^PEF_Post^^PEF_Pref2^^PEF_Pchg^^Fev1FVC_Ref^81^Fev1FVC_Pre^86^Fev1FVC_Post^)
					1. 1. 기류용적폐곡선, 잔기량및폐용적측정,일산화탄소확산능 검사 값 전송 케이스 Pre 관련 값  Post 관련 값은 존재하지 않게 된다.
				6. Patinet ID(Hurabbang) Type()PFTSPIR), Message(FVC_Ref^5.18^FVC_Pre^4.71^FVC_Pref^91^FVC_POST^4.69^FVC_Pref2^90^FVC_Pchg^0^Fev1_Ref^4.30^Fev1_Pre^4.04^Fev1_Pref^94^Fev1_Post^4.03^Fev1_Pref2^94^Fev1_Pchg^0^Fef_Ref^4.10^Fef_Pre^4.63^Fef_Pref^113^Fef_Post^4.44^Fef_Pref2^108^Fef_Pchg^-4^PEF_Ref^9.25^PEF_Pre^13.98^PEF_Pref^151^PEF_Post^13.99^PEF_Pref2^151^PEF_Pchg^^Fev1FVC_Ref^83^Fev1FVC_Pre^86^Fev1FVC_Post^86)
					1. 1. 기류용적폐곡선, 잔기량및폐용적측정,일산화탄소확산능 검사 값 전송 케이스 Pre_Post 관련 값 포함





## 테스트 케이스 샘플 파일 내용 정리
1. "1. 기류용적폐곡선, 잔기량및폐용적측정,일산화탄소확산능 검사" Numeric 값에 대한 것은 총 27가지 파라미터 값을 전달 하게 됨 
	1. 그중에 비어있는 값은 그대로 빈값으로 전달 (DB상 전달 파라미터 내용 캡처)
	2. Pre ![Pasted image 20260915132814.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915132814.png)
	3. Pre_Post ![Pasted image 20260915132849.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Pasted%20image%2020260915132849.png)
2. 6가지 신규 케이스 에 대한 테스트 샘플 파일로 테스트 동작 검증 진행 
3. 진행인원 : 김도연
4. 케이스 
	1. 1. 기류용적폐곡선, 잔기량및폐용적측정,일산화탄소확산능 검사
		1. Pre
			1. 샘플 이미지
			2. Post 컬럼 이후 값이 존재 X ![09821-FVC_PNUH-11_46_8000001.jpg](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/09821-FVC_PNUH-11_46_8000001.jpg)
			3. 샘플 txt 
			4. ![[09821-FVC_PNUH-11_46_8000001.txt]]
		2. Pre_Post
			1. 샘플이미지
			2. ![Hurabbang-FVC_PNUH-11_43_14000001.jpg](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/Hurabbang-FVC_PNUH-11_43_14000001.jpg)
			3. 샘플 txt 
			4. ![[Hurabbang-FVC_PNUH-11_43_14000001.txt]]
	2. 2.기관지검사
		1. Protocol-Aridol
			1. FEV value - normal
				1. 샘플 이미지
				2. PD[-15] FEV 1 Cumulated = 544 mg Mannitol 값에서 숫자 값만 가져오게 된다.![0982-PROVO-ARIDOL-11_41_11000001.jpg](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/0982-PROVO-ARIDOL-11_41_11000001.jpg)
				3. 샘플 TXT
				4. ![[0982-PROVO-ARIDOL-11_41_11000001.txt]]
			2. FEV value - abnormal
				1. 샘플 이미지
				2. PD[-15] FEV 1 Cumulated = not reached 라고 되어 있으며 잘못된 상태로 내부적으로 값의 인자를 넘겨줄때 "negative"로 세팅 하게 됨![0982-PROVO-ARIDOL-11_38_33000001.jpg](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/0982-PROVO-ARIDOL-11_38_33000001.jpg)
				3. 샘플 TXT
				4. ![[0982-PROVO-ARIDOL-11_38_33000001.txt]]
		2. Protocol-Provocholine
			1. FEV value-normal
				1. 샘플이미지
				2. Protocol 이 "Provocholine" 이며 "PC[-20] FEV1 = 11.0 mg/ml Methacholin" 에서 숫자값을 이용하게 됨![0982-PROVO-METHA-11_41_49000001.jpg](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/0982-PROVO-METHA-11_41_49000001.jpg)
				3. 샘플 TXT
				4. ![[0982-PROVO-METHA-11_41_49000001.txt]]
			2. FEV value-abnormal
				1. 샘플이미지
				2. Protocol 이 "Provocholine" 이며 "PC[-20] FEV1 = not reached" 에서 확인하고 "negative" 값을 전달하게 된다. ![0982-PROVO-METHA-11_40_1000001.jpg](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/260915-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%ED%85%8C%EC%8A%A4%ED%8A%B8/0982-PROVO-METHA-11_40_1000001.jpg)지
					1. 
				3. 샘플 TXT
				4. ![[0982-PROVO-METHA-11_40_1000001.txt]]
