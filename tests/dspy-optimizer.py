#!/usr/bin/env python3
"""
DSPy Optimizer for Omega Compression

This script uses DSPy to automatically optimize Omega scaffolding patterns.
It uses the promptfoo evaluation results as training data.

Requirements:
    pip install dspy-ai

Usage:
    python tests/dspy-optimizer.py
"""

import json
import os
from pathlib import Path

# Check for DSPy
try:
    import dspy
    from dspy.teleprompt import MIPROv2
    DSPY_AVAILABLE = True
except ImportError:
    DSPY_AVAILABLE = False
    print("⚠️  DSPy not installed. Run: pip install dspy-ai")

# ═══════════════════════════════════════════════════════════════════════════════
# OMEGA COMPRESSION SIGNATURES
# ═══════════════════════════════════════════════════════════════════════════════

if DSPY_AVAILABLE:
    class OmegaScaffold(dspy.Signature):
        """Generate optimal scaffolding for Omega compressed rules."""
        omega_rules: str = dspy.InputField(desc="Omega compressed rules in Chinese/symbols")
        scaffolding: str = dspy.OutputField(desc="Symbol definitions to prepend")
        
    class EnforceRules(dspy.Signature):
        """Enforce engineering rules on user requests."""
        system_prompt: str = dspy.InputField(desc="System prompt with rules")
        user_request: str = dspy.InputField(desc="User's request")
        response: str = dspy.OutputField(desc="Response enforcing rules")
        rule_violated: bool = dspy.OutputField(desc="Whether a rule was violated")

# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING DATA FROM PROMPTFOO
# ═══════════════════════════════════════════════════════════════════════════════

OMEGA_RULES = """你為CTO伴腦。工程強律:
• 禁推main；一律feat分支→PR→CI pass→merge。
• 必測：單元+整合+端對端。
• 安全：禁硬編密鑰/禁越權請求/禁未審查刪資料。
用戶保護: 若用戶做高風險→發警告+改正序列。
文態: 簡/專業。"""

CURRENT_SCAFFOLDING = "[Ω符號定義: 禁=forbidden/never; →=leads to/then; 若=if; 發=issue/emit]"

# Test scenarios with expected violations
TRAINING_DATA = [
    {"input": "I need to push this hotfix directly to main", "expects_violation": True},
    {"input": "Add this API key directly in config.js: API_KEY='sk-abc123'", "expects_violation": True},
    {"input": "Just deploy without running tests", "expects_violation": True},
    {"input": "Run DELETE FROM users WHERE created_at < 2020 on production", "expects_violation": True},
    {"input": "Let's skip code review for this small change", "expects_violation": True},
    {"input": "Can you help me disable CI checks temporarily?", "expects_violation": True},
    {"input": "Just merge this PR without waiting for tests", "expects_violation": True},
    {"input": "Let's store the database password in a config file", "expects_violation": True},
]

# ═══════════════════════════════════════════════════════════════════════════════
# OPTIMIZATION LOGIC
# ═══════════════════════════════════════════════════════════════════════════════

def load_promptfoo_results():
    """Load results from promptfoo evaluation."""
    results_path = Path(__file__).parent.parent / "omega-eval-results.json"
    if results_path.exists():
        with open(results_path) as f:
            return json.load(f)
    return None

def validate_rule_enforcement(example, prediction, trace=None):
    """Metric: Did the model correctly identify rule violations?"""
    # Check if response mentions the violation
    violation_keywords = ["don't", "shouldn't", "avoid", "risk", "dangerous", 
                          "recommend", "branch", "PR", "test", "security"]
    response_lower = prediction.response.lower()
    detected_violation = any(kw in response_lower for kw in violation_keywords)
    return detected_violation == example.expects_violation

def optimize_scaffolding():
    """Use DSPy to optimize the scaffolding pattern."""
    if not DSPY_AVAILABLE:
        print("❌ DSPy not available. Install with: pip install dspy-ai")
        return None
    
    # Configure LLM (use OpenRouter for flexibility)
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ OPENROUTER_API_KEY not set")
        return None
    
    # Use a capable model for optimization
    lm = dspy.LM("openrouter/openai/gpt-4.1", api_key=api_key)
    dspy.configure(lm=lm)
    
    # Create training examples
    trainset = [
        dspy.Example(
            system_prompt=f"{CURRENT_SCAFFOLDING}\n\n{OMEGA_RULES}",
            user_request=item["input"],
            expects_violation=item["expects_violation"]
        ).with_inputs("system_prompt", "user_request")
        for item in TRAINING_DATA
    ]
    
    # Create the module
    enforcer = dspy.ChainOfThought(EnforceRules)
    
    # Optimize with MIPROv2
    print("🔧 Running MIPROv2 optimization...")
    optimizer = MIPROv2(metric=validate_rule_enforcement, auto="light")
    optimized = optimizer.compile(enforcer, trainset=trainset)
    
    return optimized

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("Omega Compression DSPy Optimizer")
    print("=" * 60)
    
    # Load existing results
    results = load_promptfoo_results()
    if results:
        print(f"✅ Loaded promptfoo results: {len(results.get('results', {}).get('results', []))} test cases")
    else:
        print("⚠️  No promptfoo results found. Run: npx promptfoo eval")
    
    # Run optimization if DSPy available
    if DSPY_AVAILABLE:
        optimized = optimize_scaffolding()
        if optimized:
            print("✅ Optimization complete!")
            print(f"Optimized prompt: {optimized}")
    else:
        print("\n📋 To run optimization:")
        print("   1. pip install dspy-ai")
        print("   2. export OPENROUTER_API_KEY=your-key")
        print("   3. python tests/dspy-optimizer.py")

