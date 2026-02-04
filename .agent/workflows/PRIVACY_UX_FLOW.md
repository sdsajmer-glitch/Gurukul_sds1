# Privacy-First Consent UX Flow (Child Enrollment)

This document visualizes the Privacy-by-Design UX flow for the Child Identity Enrollment process, adhering to DPDP/GDPR compliance standards.

## 🧩 FigJam Flow Diagrams (Design Specification)

### Legend
- **Purple**: Primary User Actions
- **Blue**: System States / Automated Logic
- **Green**: Success / Completion
- **Red**: Revocation / Exit
- **🔒**: Locked State
- **👁**: Visible Information

### 🔹 Flow Overview

```mermaid
flowchart TD
    Start((Start)) --> Entry_NoConsent[Entry: No Consent]
    
    subgraph "Frame 1: Entry & Consent Layer"
        Entry_NoConsent -->|Biometric Locked| Consent_Review[Consent Review]
        Consent_Review -- "Review Privacy Details" --> Privacy_Modal[Privacy Details Modal]
        Privacy_Modal --> Consent_Review
    end

    Consent_Review -- "Consent Checkbox Checked?" --> Decision_Consent{Consent Given?}
    
    Decision_Consent -- Yes --> Consent_Granted[Consent Granted (Active)]
    Decision_Consent -- No/Close --> Exit_NoConsent[⚪ Exit Without Consent]

    subgraph "Frame 2: Biometric Handling"
        Consent_Granted -->|Unlock Biometrics| Biometric_Capture[Capture Biometric]
        Biometric_Capture -->|Upload/Capture| Biometric_Captured[Biometric Captured]
        
        Biometric_Captured -- "Consent Unchecked?" --> Decision_Revoke{Consent Withdrawn?}
        Decision_Revoke -- "Yes (Pre-Submit)" --> Consent_Withdrawn_Pre[🔴 Consent Withdrawn]
        Decision_Revoke -- No --> Enrollment_CTA[Initialize Enrollment]
        
        Consent_Withdrawn_Pre -->|Clear Biometric Data| Entry_NoConsent
    end
    
    subgraph "Frame 3: Completion"
        Enrollment_CTA -->|Submit Encrypted Payload| Enrollment_Completed[🟢 Enrollment Completed]
        Enrollment_Completed -->|Lock & Archive| Child_Profile[Child Profile / Privacy Controls]
    end

    style Entry_NoConsent fill:#f9f9f9,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
    style Consent_Granted fill:#e1bee7,stroke:#8e24aa,stroke-width:2px
    style Biometric_Captured fill:#e1bee7,stroke:#8e24aa,stroke-width:2px
    style Consent_Withdrawn_Pre fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style Enrollment_Completed fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px,color:#000
    style Exit_NoConsent fill:#eceff1,stroke:#546e7a,stroke-width:1px
```

## Detailed Flow States

### 🔹 Flow 1: Entry (No Consent)
*   **State**: Initial Load
*   **UI Status**:
    *   🔒 **Biometric Capture**: Locked (Blurred/Grayscale)
    *   🔒 **Submit Button**: Disabled
    *   👁 **Compliance Badge**: Visible
*   **Action**: User must navigate to the bottom "Safety & Clinical" section to find the consent checkbox.

### 🔹 Flow 2: Consent Review
*   **State**: User viewing consent section
*   **Elements**:
    *   Unchecked Checkbox (Active Consent)
    *   Plain-language summary ("I, the legal guardian, consent...")
    *   Links: "Data Visibility", "Retention Policy"
*   **Decision**: 
    *   **Check**: Proceed to Flow 3.
    *   **Close**: Exit (Flow 8).

### 🔹 Flow 3: Consent Granted
*   **State**: `consentGiven = true`
*   **System Action**:
    *   Biometric UI Unlocks (Fade in animation)
    *   Upload Button Enabled
*   **Visuals**: Avatar area becomes interactive.

### 🔹 Flow 4: Biometric Captured
*   **State**: Image selected/uploaded
*   **Elements**:
    *   Preview visible
    *   "Secure Biometric Identity" confirmed
*   **Next Step**: User fills remaining fields and clicks "Initialize Enrollment".

### 🔴 Flow 5: Consent Withdrawn (Pre-Submit)
*   **Trigger**: User unchecks the consent box *after* uploading a photo.
*   **System Action**:
    *   **Immediate Data Clearing**: `setPhotoFile(null)`
    *   UI Re-locks (Blur effect returns)
    *   Submit Button disabled.
*   **Rationale**: Data minimization; no biometric data persists without active consent.

### 🟢 Flow 7: Enrollment Completed
*   **State**: Submission Successful
*   **UI Status**:
    *   Success Animation
    *   "Identity Synchronized" message
*   **Data Handling**:
    *   Payload encrypted and sent to `admissions` table.
    *   Local form state cleared.

## 📱 Responsive & Accessibility Annotations

### Desktop (`md`+)
*   **Layout**: Centered modal, max-width 3xl.
*   **Two-Column**: Personal & Academic sections side-by-side.

### Mobile (Critical)
*   **Behavior**:
    *   Full-screen modal.
    *   **Sticky Footer**: "Initialize Enrollment" CTA always visible (disabled state).
    *   **Scroll**: Content scrolls within the view, consent is at the bottom.
*   **Touch Targets**: Minimum 44px for all inputs and the consent checkbox.

### Accessibility (WCAG AA)
*   **Focus Management**: `Ref` focus on errors.
*   **Contrast**: Text-on-dark guarantees 4.5:1 ratio.
*   **Screen Readers**: `aria-label` used where beneficial (though visible labels are preferred and implemented).

---
*Documented for Compliance Audit - 2026*
