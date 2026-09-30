---
{"dg-publish":true,"permalink":"//260911-numeric-receiver/260916-cis-numeric-receiver-app/","dg-note-properties":{"permalink":"pnuh-lung"}}
---

#부산대 #CISNumericReceiver #PNUH

## 도식화
1. CISNumericReciever, NumericSite, NumericBroker, NEISMIX, MIXSITE 등에 대한 폐기능관련 APP 별 관계에 대한 도식화 AI 통한 분석 내용 공유를 위해 정리
2.  workflow![Pasted image 20260915173208.png](/img/user/%EB%B6%84%EC%84%9D/260911-%EB%B6%80%EC%82%B0%EB%8C%80-%EC%8B%A0%EA%B7%9C%ED%8F%90%EA%B8%B0%EB%8A%A5%EC%A7%80%EC%9B%90%EA%B0%9C%EB%B0%9C%EA%B1%B4(NumericReceiver)/Pasted%20image%2020260915173208.png)
3. 내용 설명
	1. CISNumericReceiver  jpg, txt 파일(BlaceIce로 부터 뽑은 jpg, txt 데이터 ) input 폴더 넣는다.
	2. 관련 내용 파싱 이후  NumericSite로 관련 정보 전달 하고 T_NUMERICDATA Insert 
	3. NumericSite는 CISNumbericReceiver로 키 정보 전달
	4. CISNumbericReceiver NeisMix 호출 시 Jpg + NMKey 전달
	5. NEISMix 이미지와 오더 매칭 
	6. MixSite T_NUMERICINTERFACE에 오더, 환자, NMKEY^키 내용 전달
	7. NumericBroker T_NumericInterface DB 테이블 폴링 검사 ( 1초 단위)
	8. NumericBroker Key로 수치 조회
	9. NumericBroker EMR INSERT (EX> MS.MSPFTSEXA(기류용적폐곡선), MS.MSPFTLEXAM(잔기량및폐용적측정), MS.MSPFTDEXAM(일산화탄소확산능) 등...)
	10. T_NUMERCINTERFACE  STATE 'Y'로 변경

