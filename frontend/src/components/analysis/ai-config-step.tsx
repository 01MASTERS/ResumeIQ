"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { ArrowRight, Settings2, Cpu, SlidersHorizontal, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export interface AIConfigData {
  use_ai: boolean;
  use_ollama: boolean;
  ollama_model: string;
  use_custom_weights: boolean;
  weights: {
    skill_match: number;
    keyword_match: number;
    contextual_match: number;
    experience: number;
    ai_score: number;
  };
}

interface AIConfigStepProps {
  initialConfig?: AIConfigData;
  onNext: (config: AIConfigData) => void;
  onBack: () => void;
}

const DEFAULT_WEIGHTS = {
  skill_match: 30,
  keyword_match: 20,
  contextual_match: 20,
  experience: 10,
  ai_score: 20,
};

const NO_AI_WEIGHTS = {
  skill_match: 40,
  keyword_match: 30,
  contextual_match: 0,
  experience: 30,
  ai_score: 0,
};

const COLORS = ['#3b82f6', '#22d3ee', '#10b981', '#f59e0b', '#a855f7'];
const LABELS = {
  skill_match: "Skill Match",
  keyword_match: "Keyword Match",
  contextual_match: "Contextual Match",
  experience: "Experience",
  ai_score: "AI Score"
};

export function AIConfigStep({ initialConfig, onNext, onBack }: AIConfigStepProps) {
  const [config, setConfig] = useState<AIConfigData>(initialConfig || {
    use_ai: true,
    use_ollama: false,
    ollama_model: "gemma4:31b-cloud",
    use_custom_weights: false,
    weights: { ...DEFAULT_WEIGHTS }
  });

  // Automatically update weights when AI toggle changes if custom weights is off
  useEffect(() => {
    if (!config.use_custom_weights) {
      setConfig(prev => ({
        ...prev,
        weights: prev.use_ai ? { ...DEFAULT_WEIGHTS } : { ...NO_AI_WEIGHTS }
      }));
    }
  }, [config.use_ai, config.use_custom_weights]);

  const handleWeightChange = (key: keyof typeof config.weights, value: number) => {
    setConfig(prev => ({
      ...prev,
      weights: {
        ...prev.weights,
        [key]: value
      }
    }));
  };

  const totalWeight = Object.values(config.weights).reduce((a, b) => a + b, 0);
  const isValid = totalWeight === 100;

  const chartData = Object.entries(config.weights)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: LABELS[key as keyof typeof LABELS],
      value
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-2">AI Configuration</h2>
        <p className="text-muted-foreground text-lg">
          Fine-tune the scoring engine and AI parameters for this analysis.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Core AI Settings */}
        <div className="glass rounded-2xl p-6 border border-white/5 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-semibold">Evaluation Engine</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-white/5">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Enable AI Evaluation</Label>
                <p className="text-sm text-muted-foreground">Use LLMs for semantic matching and qualitative verdict.</p>
              </div>
              <Switch 
                checked={config.use_ai} 
                onCheckedChange={(v) => setConfig({...config, use_ai: v})} 
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <AnimatePresence>
              {config.use_ai && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-4 p-4 rounded-xl bg-secondary/30 border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Use Ollama (Local/Self-hosted)</Label>
                        <p className="text-sm text-muted-foreground">Toggle to use a custom Ollama endpoint instead of cloud.</p>
                      </div>
                      <Switch 
                        checked={config.use_ollama} 
                        onCheckedChange={(v) => setConfig({...config, use_ollama: v})} 
                      />
                    </div>
                    
                    {config.use_ollama && (
                      <div className="pt-2 border-t border-white/10">
                        <Label className="mb-2 block text-sm font-medium">Ollama Model Name</Label>
                        <Input 
                          value={config.ollama_model}
                          onChange={(e) => setConfig({...config, ollama_model: e.target.value})}
                          className="bg-background/50 border-white/10 focus-visible:ring-primary/50"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Weights Configuration */}
        <div className="glass rounded-2xl p-6 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold">Scoring Weights</h3>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Custom Weights</Label>
              <Switch 
                checked={config.use_custom_weights} 
                onCheckedChange={(v) => setConfig({...config, use_custom_weights: v})} 
              />
            </div>
          </div>

          <AnimatePresence>
            {config.use_custom_weights && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-6">
                    {Object.entries(config.weights).map(([key, value], idx) => {
                      if (!config.use_ai && (key === 'contextual_match' || key === 'ai_score')) return null;
                      return (
                        <div key={key} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium">{LABELS[key as keyof typeof LABELS]}</Label>
                            <span className="text-sm font-bold text-primary">{value}%</span>
                          </div>
                          <Slider 
                            value={[value]}
                            max={100}
                            step={1}
                            onValueChange={(v) => handleWeightChange(key as keyof typeof config.weights, Array.isArray(v) ? v[0] : (v as number))}
                            className="cursor-pointer"
                          />
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="flex flex-col items-center justify-center bg-secondary/20 rounded-xl p-4 border border-white/5 relative">
                    <div className="w-full h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181B', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            itemStyle={{ color: '#FAFAFA' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className={`text-3xl font-bold ${isValid ? 'text-emerald-500' : 'text-destructive'}`}>
                        {totalWeight}%
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total</span>
                    </div>

                    {!isValid && (
                      <div className="absolute bottom-4 flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-2 rounded-lg text-sm font-medium">
                        <AlertCircle className="w-4 h-4" />
                        Weights must equal 100%
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!config.use_custom_weights && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-white/5 mt-4">
              <p className="text-muted-foreground text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Using recommended optimized weights based on your engine settings.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button 
          onClick={() => onNext(config)} 
          size="lg" 
          className="rounded-xl px-8" 
          disabled={config.use_custom_weights && !isValid}
        >
          Begin Analysis <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}

// Temporary icon definition since lucide might not export CheckCircle2 in all versions
function CheckCircle2(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
  );
}
