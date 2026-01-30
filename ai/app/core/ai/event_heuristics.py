from typing import List

class EventHeuristics:
    ENGLISH_KEYWORDS = [
        "meeting", "schedule", "calendar", "appointment", "zoom", "google meet", "reminder", "deadline"
    ]
    ARABIC_KEYWORDS = [
        "اجتماع", "موعد", "تقويم", "تذكير", "مقابلة", "ميعاد", "جدول"
    ]

    @classmethod
    def should_extract_events(cls, text: str) -> bool:
        """
        Check if text contains any keywords that suggest an event/meeting.
        Case insensitive.
        """
        text_lower = text.lower()
        
        # Check English
        if any(kw in text_lower for kw in cls.ENGLISH_KEYWORDS):
            return True
            
        # Check Arabic (normalization might be needed in production)
        if any(kw in text_lower for kw in cls.ARABIC_KEYWORDS):
            return True
            
        return False
