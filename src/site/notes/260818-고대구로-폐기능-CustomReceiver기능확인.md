---
{"dg-publish":true,"dg-permalink":"260818-kumc-added-parameter-interface-functions-review2","permalink":"/260818-kumc-added-parameter-interface-functions-review2/","dg-note-properties":{}}
---

#CustomReceiver #interfacebroker #ExtraData #CVSParser #연동샘플 #연동항목 

[[260813-고대구로-폐기능-CustomReceiver기능확인\|260813-고대구로-폐기능-CustomReceiver기능확인]]
## 결론
1. customReceiver 고대 구로 설정이 제대로 인지 재 확인이 필요하다
2. customReceiver 생성한 XML 파일을 InterfaceBroker에서 API통해 수치값 관련 연동하는 것 같다.
	1. 추가 연동 관련 customReceiver + InterfaceBroker 변경 이 필요할 수 있다.
		1. 호환성에 대한 것도 고려 해야 함
3. 추가 연동 파라미터 항목에 대한 EMR API 통해 전달될 내용에 대해서도 EMR 쪽에 확인 및 필요시 추가가 되어야 한다. ( 아래 확인내용 이미지 참조!, 추가 연동 파라미터) 

## 확인내용
1. 연동 파라미터 항목은 아래와 같으며  관련 파라미터에 대한 연동 수치 항목 도 기존 7 -> 8개로 추가된 것으로 파악 CV% 항목 추가 
2. 추가 연동 파라미터 및 추가 값 항목 내용 캡처
	1. ![추가된 파라미터 부분.png](/img/user/%EC%B6%94%EA%B0%80%EB%90%9C%20%ED%8C%8C%EB%9D%BC%EB%AF%B8%ED%84%B0%20%EB%B6%80%EB%B6%84.png)
3. 샘플 파라미터 txt 파일
	1. ![[수치연동 추가 샘플.txt]]
4. 예상 구현 내용 요약
	1. customreceiver 
		1. Parshing 기능 변경 
	2. InterfaceBroker 
		1. XML 파싱
			1. customreceiver 에서 생성및 파싱
		2. EMR API 호출
			1. 추가된 파라미터에 대한 EMR 쪽 처리 가능여부 확인
			2. 인터페이스 관련 변경 여부 
				1. 현재 AI 상에서는 변경 필요 없다는 내용이긴 함

## 추가 검토 
	1. customreceiver 실제 정상동작 여부 확인 필요 
		1. customreceiver 생성한 storage 상에 xml 파일 생성 여부 확인 필요!
		2. 현재 고대 구로 customreceiver 설정이 맞는지 재 확인도 필요
	2. 현재 Interfacebroker 관련  폐기능관련 설정 내용 세부 검토
		1. customreceiver + InterfaceBroker 동작이 연관이 있는지 검토 필요!