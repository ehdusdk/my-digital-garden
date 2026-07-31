---
{"dg-publish":true,"permalink":"/c-c/","dg-note-properties":{}}
---

# C샵 라이브러리 C 호출 방법 리스트 및 내용 정리

#csharp #cpp #interop #dotnet #cppcli #com #nativeaot

---

## 📌 개요

C#으로 작성된 .NET 라이브러리(`.dll`)를 Native C++ 애플리케이션에서 호출하는 연동 방식은 프로젝트 환경(.NET Framework vs .NET Core/5+, 성능 요구사항, COM 등록 가능 여부 등)에 따라 크게 **5가지**로 구분됩니다.

---

## 📊 C# ➔ C++ 호출 방식 한눈에 보기

| 번호 | 방식 (Method) | 주요 특징 | 추천 사용 환경 | 구현 난이도 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Native AOT / DllExport** | C# 함수를 네이티브 C DLL 형태로 직접 내보냄 | 최신 .NET 7+ 및 순수 C-Style API 연동 | ⭐ (가장 쉬움) |
| **2** | **C++/CLI 래퍼 (Bridge)** | C++/CLI를 사용하여 Native C++과 .NET 간의 가교 역할 | C++과 C# 간 복잡한 객체/데이터 교환 | ⭐⭐ (권장) |
| **3** | **COM Interop (CCW)** | C# 클래스를 COM(Component Object Model) 객체로 등록 | 레거시 C++ 시스템 (MFC, C++ Builder) | ⭐⭐⭐ |
| **4** | **.NET Hosting API (`hostfxr`)** | Native C++에서 .NET 런타임(CoreCLR)을 동적으로 직접 로드 | C++ 중심의 저수준 .NET Core 제어 | ⭐⭐⭐⭐ |
| **5** | **IPC / gRPC 통신** | C#을 별도 프로세스로 실행 후 프로세스 간 통신 | 32/64비트 이종 환경 또는 프로세스 분리 | ⭐⭐ |

---

## 1. Native AOT / DllExport (C-Style Direct Export)

C# 메서드에 내보내기 속성을 지정하여, C++에서 `LoadLibrary()` / `GetProcAddress()` 또는 `.lib` 정적 링킹 방식으로 C DLL처럼 직접 호출하는 방식입니다.

### 1) 최신 .NET 7/8/9 (`[UnmanagedCallersOnly]`)
.NET 7부터 정식 지원하는 **Native AOT (Ahead-Of-Time)** 기법입니다.

* **C# 코드 (`MyCSharpLib.csproj`에 `<PublishAot>true</PublishAot>` 추가):**
  ```csharp
  using System.Runtime.InteropServices;

  namespace MyCSharpLib;

  public class MathLib
  {
      [UnmanagedCallersOnly(EntryPoint = "AddNumbers")]
      public static int AddNumbers(int a, int b)
      {
          return a + b;
      }
  }
  ```

* **Native C++ 코드:**
  ```cpp
  #include <windows.h>
  #include <iostream>

  typedef int(*AddFunc)(int, int);

  int main() {
      HMODULE hDll = LoadLibrary(L"MyCSharpLib.dll");
      if (!hDll) return -1;

      AddFunc AddNumbers = (AddFunc)GetProcAddress(hDll, "AddNumbers");
      if (AddNumbers) {
          int result = AddNumbers(10, 20);
          std::cout << "Result: " << result << std::endl;
      }
      
      FreeLibrary(hDll);
      return 0;
  }
  ```

### 2) 레거시 .NET Framework (`DllExport` NuGet 패키지)
.NET Framework (4.x) 프로젝트의 경우 `RG.DllExport` 패키지를 설치하여 동일하게 C-Style Export 함수를 만들 수 있습니다.

* **장점:** C++ 관점에서 일반 C DLL 호출과 100% 동일하여 구조가 가장 깔끔함.
* **단점:** C# 클래스 객체를 직접 전달하기 어렵고 기본 데이터 타입(int, double, char* 등) 중심 연동에 적합.

---

## 2. C++/CLI 래퍼 (C++/CLI Bridge) — 가장 추천하는 방식

C++/CLI는 Native C++ 코드와 Managed .NET 코드를 한 프로젝트 안에서 동시에 다룰 수 있는 Microsoft 컴파일러 확장 기술입니다.

```
[ Native C++ App ] ──(Native C++ API)──> [ C++/CLI Wrapper DLL ] ──(Managed Call)──> [ C# Assembly ]
```

### 구현 단계

1. **C# 라이브러리 작성 (`MyCSharpLib.dll`)**:
   ```csharp
   namespace MyCSharp
   {
       public class Calculator
       {
           public int Multiply(int a, int b) => a * b;
       }
   }
   ```

2. **C++/CLI 브릿지 프로젝트 생성 (`/clr` 옵션 설정)**:
   - C# DLL 참조 추가 (`#using <MyCSharpLib.dll>`)
   - Native C++ 애플리케이션에 노출할 순수 C++ 헤더 및 클래스 작성

   ```cpp
   // C++/CLI Wrapper.h
   #pragma once
   #ifdef WRAPPER_EXPORTS
   #define WRAPPER_API __declspec(dllexport)
   #else
   #define WRAPPER_API __declspec(dllimport)
   #endif

   class WRAPPER_API NativeCalculator {
   public:
       NativeCalculator();
       ~NativeCalculator();
       int Multiply(int a, int b);
   private:
       void* m_pImpl; // C# 객체를 감싸는 Opaque 포인터 (gcroot)
   };
   ```

3. **Native C++ 메인 프로젝트**:
   - C++/CLI 헤더 파일만 `#include`하여 일반 C++ 객체처럼 사용.

* **장점:** C++과 C# 간의 복잡한 객체 생성, 데이터 변환, 콜백(Callback) 연동이 가장 강력하고 자유로움.
* **단점:** MSVC (Visual C++) 전용 기술임.

---

## 3. COM Interop (CCW - COM Callable Wrapper)

C# 클래스를 Windows **COM(Component Object Model)** 객체로 포장하여 C++에서 `CoCreateInstance()` 또는 `#import`로 불러오는 방식입니다.

### 구현 단계

1. **C# 코드 (COM 인터페이스 및 클래스 노출)**:
   ```csharp
   using System.Runtime.InteropServices;

   [Guid("11111111-2222-3333-4444-555555555555")]
   [ComVisible(true)]
   public interface IMyComLib {
       int Calculate(int val);
   }

   [Guid("66666666-7777-8888-9999-000000000000")]
   [ClassInterface(ClassInterfaceType.None)]
   [ComVisible(true)]
   public class MyComLib : IMyComLib {
       public int Calculate(int val) => val * 10;
   }
   ```
2. **COM 등록**: `regasm MyCSharpLib.dll /tlb` 명령어로 등록 (또는 Manifest를 활용한 Registration-Free COM).

3. **Native C++ 코드**:
   ```cpp
   #include <windows.h>
   #import "MyCSharpLib.tlb" raw_interfaces_only

   int main() {
       CoInitialize(NULL);
       MyCSharpLib::IMyComLibPtr pLib(__uuidof(MyCSharpLib::MyComLib));
       
       long result = 0;
       pLib->Calculate(5, &result);
       
       CoUninitialize();
   }
   ```

* **장점:** 레거시 MFC, Delphi, C++ Builder 등 표준 COM을 지원하는 모든 환경에서 연동 가능.
* **단점:** 배포 시 관리자 권한 COM 등록(`regasm`) 과정 또는 Manifest 설정이 필요함.

---

## 4. .NET Hosting API (`nethost` / `hostfxr`)

Native C++ 애플리케이션이 실행 중에 **.NET Core/5+ 런타임(CoreCLR)을 동적으로 직접 로드**하고, C# 메서드의 포인터를 얻어 호출하는 방식입니다.

### 구현 단계
1. C++ 프로젝트에 `nethost.lib` / `hostfxr.dll` 포함.
2. `hostfxr_initialize_for_runtime_config()`로 .NET 런타임 인스턴스 초기화.
3. `load_assembly_and_get_function_pointer()`를 사용하여 C# 메서드 함수 포인터 획득 후 실행.

```cpp
// hostfxr를 사용하여 C# 메서드 포인터 획득 예시
load_assembly_and_get_function_pointer_fn load_assembly_and_get_function_pointer = nullptr;

typedef int (*component_entry_point_fn)(int arg);
component_entry_point_fn csharp_func = nullptr;

load_assembly_and_get_function_pointer(
    L"MyCSharpLib.dll",
    L"MyNamespace.MyClass, MyCSharpLib",
    L"MyMethod",
    UNMANAGEDCALLERSONLY_METHOD,
    nullptr,
    (void**)&csharp_func);

// C# 함수 실행
csharp_func(100);
```

* **장점:** C++ 실행 파일 내에서 .NET Core 런타임 생명주기 전체를 제어할 수 있음.
* **단점:** C++ 측 런타임 초기화 코드가 복잡함.

---

## 5. IPC (프로세스 간 통신 / gRPC)

C# 코드를 독립된 실행 파일(`.exe` 서비스 또는 데몬)로 실행하고, Native C++과 **프로세스 간 통신(IPC)**으로 데이터를 주고받는 방식입니다.

* **주요 통신 수단:** Named Pipe, Shared Memory, Local gRPC, REST API
* **장점:** 
  - **프로세스 격리성:** C# 쪽에서 예외나 크래시가 발생해도 C++ 메인 프로세스에 영향을 주지 않음.
  - **아키텍처(32bit / 64bit) 불일치 해결:** 32비트 C++ 프로그램이 64비트 C# DLL을 호출해야 할 때 가장 명쾌한 해결책.
* **단점:** 데이터 직렬화/역직렬화 및 IPC 통신 오버헤드 존재.

---

## 💡 종합 결론 및 추천 가이드

1. **간단한 C 스타일 함수 호출 위주인 경우:**
   👉 **Native AOT (`[UnmanagedCallersOnly]`)** 또는 **`DllExport`** 선택

2. **C++과 C# 간 복잡한 객체/데이터 구조체/콜백 교환이 필요한 경우:**
   👉 **C++/CLI Bridge 방식** 선택 (가장 대중적이고 안정적)

3. **기존 레거시 C++ (MFC/C++ Builder 등) 시스템 연동인 경우:**
   👉 **COM Interop (CCW)** 방식 선택

4. **32비트 C++ 애플리케이션 ➔ 64비트 C# 모듈 호출인 경우:**
   👉 **IPC (Named Pipe / gRPC)** 방식 선택
