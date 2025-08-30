
'use client';
import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  getFarmingAdvice,
  GetFarmingAdviceOutput,
} from '@/ai/flows/ai-farmer-assistant';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, User, Bot, Trash2, Send, Mic, Volume2, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import JumpingDotsLoader from '@/components/ui/jumping-dots-loader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const formSchema = z.object({
  query: z.string().min(10, 'Please ask a more detailed question.'),
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
}

export default function AiFarmerPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { query: '' },
  });

  // Load messages and location from localStorage on initial render
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('ai-farmer-messages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
      
      const savedLocation = localStorage.getItem('ai-farmer-location');
      if (savedLocation) {
        setLocation(savedLocation);
      } else {
        const loc = window.prompt("To provide weather-aware advice, please enter your location (e.g., 'Delhi, India'):");
        if (loc) {
          setLocation(loc);
          localStorage.setItem('ai-farmer-location', loc);
        }
      }
    } catch (error) {
      console.error("Failed to load from localStorage", error);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('ai-farmer-messages', JSON.stringify(messages));
      } catch (error) {
        console.error("Failed to save messages to localStorage", error);
      }
    }
  }, [messages]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Cleanup effect to abort fetch on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isLoading) return;

    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: values.query };
    setMessages((prev) => [...prev, userMessage]);
    form.reset();

    const controller = new AbortController();
    abortControllerRef.current = controller;
  
    try {
      const advicePromise = getFarmingAdvice({
        query: values.query,
        location: location || undefined,
      });

      const result: GetFarmingAdviceOutput = await advicePromise;
      if (controller.signal.aborted) return;


      let ttsResult;
      try {
        if (!controller.signal.aborted) {
          ttsResult = await textToSpeech(result.advice);
        }
      } catch (ttsError: any) {
         if (ttsError.name !== 'AbortError') {
            console.error("Text-to-speech conversion failed:", ttsError);
         }
      }
  
      if (controller.signal.aborted) return;

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.advice,
        audioUrl: ttsResult?.media,
      };
      setMessages((prev) => [...prev, assistantMessage]);
  
    } catch (error: any) {
       if (error.name !== 'AbortError') {
        console.error('Error getting farming advice:', error);
        toast({
          title: 'Error',
          description: 'Failed to get advice. Please try again.',
          variant: 'destructive',
        });
        setMessages((prev) => prev.slice(0, -1)); // Remove user message on error
      }
    } finally {
       if (!controller.signal.aborted) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }

  const handleClearChat = () => {
    setMessages([]);
    try {
      localStorage.removeItem('ai-farmer-messages');
      toast({
        title: 'Chat Cleared',
        description: 'Your conversation history has been cleared.',
      });
    } catch (error) {
       console.error("Failed to clear messages from localStorage", error);
    }
  };

   const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsRecording(true);
        toast({ title: 'Listening...' });
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          form.setValue('query', transcript);
          form.handleSubmit(onSubmit)();
        }
      };
      
      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          console.log('No speech detected.');
          return;
        }
        console.error('Speech recognition error', event.error);
        toast({ title: 'Voice Error', description: `Could not recognize speech: ${event.error}`, variant: 'destructive' });
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      toast({ title: 'Voice not supported', description: 'Your browser does not support voice recognition.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    setupSpeechRecognition();
  }, []);

  const toggleRecording = () => {
    if (isLoading) return;
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(e => console.error("Audio playback failed", e));
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setMessages((prev) => {
        // Remove the last user message that was in progress
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.role === 'user') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
  };

  return (
    <div className="container mx-auto px-4 h-[calc(100vh-57px)] flex flex-col pt-0">
      <audio ref={audioRef} className="hidden" />
      <div className="text-center mb-4">
        <h1 className="text-4xl font-bold font-headline text-foreground">AI Farmer Assistant</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Your personal agricultural expert, available 24/7.
        </p>
      </div>

       <div className="flex justify-start mb-4">
          {messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="clear-chat-button box">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Chat
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your current chat history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearChat}>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          )}
        </div>


      <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-lg overflow-hidden">
        <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-muted-foreground p-8 flex flex-col items-center justify-center h-full">
                <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg">Ask me anything about farming!</p>
                <p className="text-sm">e.g., "What are the best irrigation methods for sandy soil?"</p>
              </div>
            )}
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'flex items-start gap-4',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar>
                    <AvatarFallback>
                      <Bot />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-xl rounded-lg px-4 py-3 relative group',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                   {message.role === 'assistant' && message.audioUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -bottom-4 -right-4 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => playAudio(message.audioUrl!)}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {message.role === 'user' && (
                  <Avatar>
                    <AvatarFallback>
                      <User />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))}
             {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-4 justify-start"
              >
                <Avatar>
                  <AvatarFallback>
                    <Bot />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-3 flex items-center">
                  <JumpingDotsLoader />
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 bg-background">
          {isLoading ? (
            <div className="flex justify-center">
              <Button onClick={handleStop} variant="outline" className="w-full">
                <StopCircle className="h-4 w-4 mr-2" />
                Stop Generating
              </Button>
            </div>
          ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex items-center gap-4"
            >
              <Button type="button" variant="ghost" size="icon" onClick={toggleRecording} className={cn(isRecording && "bg-red-500/20 text-red-500")} disabled={isLoading}>
                <Mic className="h-4 w-4" />
              </Button>
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Textarea
                        placeholder="Ask your farming question here..."
                        className="resize-none no-scrollbar"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                            e.preventDefault();
                            form.handleSubmit(onSubmit)();
                          }
                        }}
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <button type="submit" disabled={isLoading} className="send-button-style">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span><Send className="text-black" /></span>
                )}
              </button>
            </form>
          </Form>
          )}
        </div>
      </div>
    </div>
  );
}
